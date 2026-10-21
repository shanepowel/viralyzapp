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

// Expands an IPv6 address (dotted-decimal tail and "::" compression allowed)
// to its 8 hex groups, so a mapped IPv4 address can be recognized whether
// Node renders it as "::ffff:127.0.0.1" or its canonical "::ffff:7f00:1".
function expandIpv6Groups(ip: string): string[] | null {
  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const expandGroup = (group: string): string[] => {
    if (!group.includes(".")) return [group];
    const octets = group.split(".").map(Number);
    if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return [group];
    }
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    return [hi, lo];
  };

  const head = halves[0] ? halves[0].split(":").flatMap(expandGroup) : [];
  if (halves.length === 1) return head.length === 8 ? head : null;

  const tail = halves[1] ? halves[1].split(":").flatMap(expandGroup) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill("0"), ...tail];
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;

  const groups = expandIpv6Groups(lower);
  if (groups) {
    // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) addresses carry
    // a real IPv4 address in the low 32 bits — check that address too,
    // regardless of whether it's written in dotted or hex form.
    const isMapped = groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff";
    const isCompatible = groups.slice(0, 6).every((g) => g === "0");
    if (isMapped || isCompatible) {
      const hi = parseInt(groups[6], 16);
      const lo = parseInt(groups[7], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (isMapped || hi !== 0 || lo > 1) return isBlockedIpv4(v4);
    }
  }

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
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardDeadline);
      fn();
    };

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
            settle(() =>
              reject(new SafeFetchError("too_large", `Response exceeded ${opts.maxBytes} bytes`)),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          settle(() =>
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
          );
        });
        res.on("error", (err) => settle(() => reject(err)));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      settle(() => reject(new SafeFetchError("timeout", `Request timed out after ${opts.timeoutMs}ms`)));
    });
    req.on("error", (err) => {
      settle(() =>
        reject(err instanceof SafeFetchError ? err : new SafeFetchError("timeout", err.message)),
      );
    });
    // The socket's `timeout` option above resets on every byte received, so a
    // server that trickles small chunks can hold the connection open far
    // past timeoutMs. This hard deadline bounds the whole request instead.
    const hardDeadline = setTimeout(() => {
      req.destroy();
      settle(() => reject(new SafeFetchError("timeout", `Request exceeded ${opts.timeoutMs}ms`)));
    }, opts.timeoutMs);
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
