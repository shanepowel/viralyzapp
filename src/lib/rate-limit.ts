import { hasRedis } from "@/lib/env";

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();

async function redisIncr(key: string, windowSec: number): Promise<number> {
  const { default: Redis } = await import("ioredis");
  const redis = new Redis(process.env.REDIS_URL!.trim());
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSec);
    return n;
  } finally {
    redis.disconnect();
  }
}

function memoryIncr(key: string, windowSec: number): number {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  retryAfterSec: number;
};

/** Sliding fixed-window limiter. Uses Redis when REDIS_URL is set. */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const bucketKey = `rl:${opts.key}`;
  const count = hasRedis()
    ? await redisIncr(bucketKey, opts.windowSec)
    : memoryIncr(bucketKey, opts.windowSec);

  const ok = count <= opts.limit;
  return {
    ok,
    remaining: Math.max(0, opts.limit - count),
    limit: opts.limit,
    retryAfterSec: ok ? 0 : opts.windowSec,
  };
}

export function clientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
