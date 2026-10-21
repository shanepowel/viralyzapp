import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();
vi.mock("node:dns", () => ({
  default: { promises: { lookup: (...args: unknown[]) => lookupMock(...args) } },
  promises: { lookup: (...args: unknown[]) => lookupMock(...args) },
}));

type FakeResponder = (opts: Record<string, unknown>) => {
  status: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
  neverEnds?: boolean;
};

function makeFakeRequest(responder: FakeResponder) {
  return (opts: Record<string, unknown>, callback: (res: EventEmitter & { statusCode: number; headers: Record<string, string> }) => void) => {
    const req = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: () => void;
    };
    req.end = () => {
      queueMicrotask(() => {
        const { status, headers = {}, chunks = [], neverEnds } = responder(opts);
        const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string> };
        res.statusCode = status;
        res.headers = headers;
        callback(res);
        if (!neverEnds) {
          queueMicrotask(() => {
            for (const chunk of chunks) res.emit("data", chunk);
            res.emit("end");
          });
        }
      });
    };
    req.destroy = () => {};
    return req;
  };
}

const httpRequestMock = vi.fn();
const httpsRequestMock = vi.fn();
vi.mock("node:http", () => ({
  default: { request: (...args: Parameters<typeof httpRequestMock>) => httpRequestMock(...args) },
}));
vi.mock("node:https", () => ({
  default: { request: (...args: Parameters<typeof httpsRequestMock>) => httpsRequestMock(...args) },
}));

beforeEach(() => {
  lookupMock.mockReset();
  httpRequestMock.mockReset();
  httpsRequestMock.mockReset();
  // Default: any hostname not explicitly stubbed resolves to a public address.
  lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("safeFetch — blocked addresses", () => {
  it.each([
    ["http://localhost/"],
    ["http://127.0.0.1/"],
    ["http://10.0.0.5/"],
    ["http://169.254.169.254/"],
    ["http://[::1]/"],
  ])("rejects %s", async (url) => {
    const { safeFetch, SafeFetchError } = await import("@/lib/safe-fetch");
    await expect(safeFetch(url)).rejects.toThrow(SafeFetchError);
    await expect(safeFetch(url)).rejects.toMatchObject({ code: "blocked_address" });
  });

  it("rejects file:// as a bad scheme", async () => {
    const { safeFetch, SafeFetchError } = await import("@/lib/safe-fetch");
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(SafeFetchError);
    await expect(safeFetch("file:///etc/passwd")).rejects.toMatchObject({ code: "bad_scheme" });
  });

  it("rejects a hostname that DNS-resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    const { safeFetch } = await import("@/lib/safe-fetch");
    await expect(safeFetch("http://evil.example.com/")).rejects.toMatchObject({
      code: "blocked_address",
    });
  });

  it("rejects a public URL that redirects to a blocked address", async () => {
    httpRequestMock.mockImplementation(
      makeFakeRequest(() => ({ status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } })),
    );
    const { safeFetch } = await import("@/lib/safe-fetch");
    await expect(safeFetch("http://shop.example.com/")).rejects.toMatchObject({
      code: "blocked_address",
    });
  });
});

describe("safeFetch — limits", () => {
  it("enforces maxBytes", async () => {
    const big = Buffer.alloc(100, "a");
    httpRequestMock.mockImplementation(
      makeFakeRequest(() => ({ status: 200, headers: { "content-type": "text/html" }, chunks: [big, big] })),
    );
    const { safeFetch, SafeFetchError } = await import("@/lib/safe-fetch");
    await expect(safeFetch("http://shop.example.com/", { maxBytes: 150 })).rejects.toThrow(
      SafeFetchError,
    );
    await expect(
      safeFetch("http://shop.example.com/", { maxBytes: 150 }),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("enforces timeoutMs", async () => {
    httpRequestMock.mockImplementation((opts) => {
      const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
      req.end = () => {
        // Never calls callback — simulates a hung connection.
        queueMicrotask(() => {
          if ((opts as { timeout?: number }).timeout) {
            req.emit("timeout");
          }
        });
      };
      req.destroy = () => {};
      return req;
    });
    const { safeFetch, SafeFetchError } = await import("@/lib/safe-fetch");
    await expect(safeFetch("http://shop.example.com/", { timeoutMs: 10 })).rejects.toThrow(
      SafeFetchError,
    );
  });

  it("succeeds for a normal public response", async () => {
    const body = Buffer.from("<html>hi</html>");
    httpRequestMock.mockImplementation(
      makeFakeRequest(() => ({ status: 200, headers: { "content-type": "text/html" }, chunks: [body] })),
    );
    const { safeFetch } = await import("@/lib/safe-fetch");
    const result = await safeFetch("http://shop.example.com/");
    expect(result.status).toBe(200);
    expect(result.body).toBe("<html>hi</html>");
  });
});
