import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export type SafeFetchErrorCode =
  | "blocked_address"
  | "too_large"
  | "timeout"
  | "bad_scheme"
  | "too_many_redirects";

export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

export type SafeFetchResult = {
  status: number;
  contentType: string;
  body: string;
};

const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 5;

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  const firstGroup = lower.split(":")[0];
  if (/^fe[89ab][0-9a-f]$/.test(firstGroup)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) return true; // fc00::/7 unique local
  if (firstGroup.startsWith("ff")) return true; // multicast
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true;
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) return [hostname];
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

function request(
  url: URL,
  ip: string,
  opts: Required<SafeFetchOptions>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        host: ip,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        headers: { Host: url.host, "User-Agent": "ViralyzBrandImport/1.0" },
        servername: url.protocol === "https:" ? url.hostname : undefined,
        timeout: opts.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > opts.maxBytes) {
            req.destroy();
            reject(new SafeFetchError("too_large", `Response exceeded ${opts.maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new SafeFetchError("timeout", `Request timed out after ${opts.timeoutMs}ms`));
    });
    req.on("error", (err) => {
      if (err instanceof SafeFetchError) {
        reject(err);
      } else {
        reject(new SafeFetchError("timeout", err.message));
      }
    });
    req.end();
  });
}

async function fetchOnce(
  rawUrl: string,
  opts: Required<SafeFetchOptions>,
  redirectsLeft: number,
): Promise<SafeFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("bad_scheme", `Not a valid URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("bad_scheme", `Unsupported scheme: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname.toLowerCase() === "localhost") {
    throw new SafeFetchError("blocked_address", "localhost is always blocked");
  }

  const addresses = await resolveAddresses(hostname);
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new SafeFetchError("blocked_address", `${url.hostname} resolves to a blocked address`);
  }

  // Connect to the address we just validated — never re-resolve the hostname
  // at connect time, which is what a DNS-rebinding attack relies on.
  const { status, headers, body } = await request(url, addresses[0], opts);

  if ([301, 302, 303, 307, 308].includes(status) && headers.location) {
    if (redirectsLeft <= 0) {
      throw new SafeFetchError("too_many_redirects", `Exceeded ${opts.maxRedirects} redirects`);
    }
    const next = new URL(headers.location, url);
    return fetchOnce(next.toString(), opts, redirectsLeft - 1);
  }

  return {
    status,
    contentType: headers["content-type"] ?? "",
    body: body.toString("utf8"),
  };
}

export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const resolved: Required<SafeFetchOptions> = {
    maxBytes: opts.maxBytes ?? DEFAULT_MAX_BYTES,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRedirects: opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
  };
  return fetchOnce(url, resolved, resolved.maxRedirects);
}
