import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { balance, grant, reserve } from "@/lib/credits";
import type { Copy } from "@/lib/copy";
import { processCreativeJob } from "@/lib/generation";
import { prisma } from "@/lib/prisma";
import { FakeProvider } from "@/lib/providers/fake";

const requireApiSessionMock = vi.fn();
vi.mock("@/lib/api", () => ({
  requireApiSession: () => requireApiSessionMock(),
}));

const getImageProviderMock = vi.fn();
vi.mock("@/lib/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers")>();
  return { ...actual, getImageProvider: () => getImageProviderMock() };
});

const hasAnthropicMock = vi.fn();
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, hasAnthropic: () => hasAnthropicMock() };
});

// Pretend every job was queued, so route tests never kick off inline
// processing that would outlive the test's own fixtures.
vi.mock("@/lib/queue", () => ({ enqueueStudioJob: async () => true }));

const STUB_COPY: Copy = {
  headline: "Shop the new collection",
  primaryText: "Hand-poured, made in small batches.",
  cta: "Shop now",
  imagePrompt: "A minimalist product photo on a neutral background, no text.",
};
const stubWriteCopy = async () => STUB_COPY;

let userId: string;
let brandId: string;
let productId: string;

beforeEach(async () => {
  const id = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `gen-${id}@test.local`, name: "Test User", handle: `gen-${id}` },
  });
  userId = user.id;
  const brand = await prisma.brand.create({
    data: { userId, name: "Test Brand", colors: ["#4b2e2e"], confirmedAt: new Date() },
  });
  brandId = brand.id;
  const product = await prisma.product.create({
    data: { brandId, title: "Test Product", imageUrls: ["https://cdn.example.com/p.jpg"], price: 38 },
  });
  productId = product.id;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  vi.clearAllMocks();
});

async function makeCreative(angle: "offer" | "problem" | "proof" | "demo" = "offer") {
  return prisma.creative.create({
    data: {
      userId,
      brandId,
      productId,
      placement: "meta_feed_1x1",
      angle,
      tag: `vz_${randomUUID().slice(0, 4)}`,
      status: "pending",
    },
  });
}

describe("processCreativeJob", () => {
  it("settles credits and saves a Check on success", async () => {
    await grant(userId, 10, "opening balance");
    const creative = await makeCreative();
    await reserve(userId, 1, creative.id);

    await processCreativeJob(creative.id, { provider: new FakeProvider(), writeCopyFn: stubWriteCopy });

    const updated = await prisma.creative.findUniqueOrThrow({ where: { id: creative.id } });
    expect(updated.status).toBe("ready");
    expect(updated.headline).toBe(STUB_COPY.headline);
    expect(updated.provider).toBe("fake");

    const checks = await prisma.check.findMany({ where: { creativeId: creative.id } });
    expect(checks).toHaveLength(1);

    expect(await balance(userId)).toBe(9);
  });

  it("refunds exactly once on a failed variant", async () => {
    await grant(userId, 10, "opening balance");
    const creative = await makeCreative();
    await reserve(userId, 1, creative.id);

    const provider = new FakeProvider();
    provider.failNext(1);
    await processCreativeJob(creative.id, { provider, writeCopyFn: stubWriteCopy });

    const updated = await prisma.creative.findUniqueOrThrow({ where: { id: creative.id } });
    expect(updated.status).toBe("failed");
    expect(await balance(userId)).toBe(10);

    // A second refund attempt (e.g. a retry hitting the same failure) must
    // not double-refund — the ledger's own idempotency on (refId, kind)
    // guards this, but confirm the pipeline doesn't somehow restore twice.
    const provider2 = new FakeProvider();
    provider2.failNext(1);
    await processCreativeJob(creative.id, { provider: provider2, writeCopyFn: stubWriteCopy });
    expect(await balance(userId)).toBe(10);
  });

  it("does nothing when reprocessing an already-ready creative", async () => {
    await grant(userId, 10, "opening balance");
    const creative = await makeCreative();
    await reserve(userId, 1, creative.id);
    await processCreativeJob(creative.id, { provider: new FakeProvider(), writeCopyFn: stubWriteCopy });
    expect(await balance(userId)).toBe(9);

    // A provider that would throw if actually called — proves the ready
    // short-circuit returns before touching the provider at all.
    const provider = new FakeProvider();
    provider.failNext(1);
    await processCreativeJob(creative.id, { provider, writeCopyFn: stubWriteCopy });

    const updated = await prisma.creative.findUniqueOrThrow({ where: { id: creative.id } });
    expect(updated.status).toBe("ready");
    expect(await balance(userId)).toBe(9);
  });

  it("never generates a failed (already refunded) creative for free on reprocessing", async () => {
    await grant(userId, 10, "opening balance");
    const creative = await makeCreative();
    await reserve(userId, 1, creative.id);

    const failing = new FakeProvider();
    failing.failNext(1);
    await processCreativeJob(creative.id, { provider: failing, writeCopyFn: stubWriteCopy });
    expect(await balance(userId)).toBe(10);

    await processCreativeJob(creative.id, { provider: new FakeProvider(), writeCopyFn: stubWriteCopy });

    const updated = await prisma.creative.findUniqueOrThrow({ where: { id: creative.id } });
    expect(updated.status).toBe("failed");
    expect(updated.compositeUrl).toBeNull();
    expect(await balance(userId)).toBe(10);
  });

  it("fails and refunds a variant whose image prompt is blocked by moderation", async () => {
    await grant(userId, 10, "opening balance");
    const creative = await makeCreative();
    await reserve(userId, 1, creative.id);

    const provider = new FakeProvider();
    const generateSpy = vi.spyOn(provider, "generate");
    const blockedCopy = async () => ({ ...STUB_COPY, imagePrompt: "A celebrity holding the candle" });
    await processCreativeJob(creative.id, { provider, writeCopyFn: blockedCopy });

    const updated = await prisma.creative.findUniqueOrThrow({ where: { id: creative.id } });
    expect(updated.status).toBe("failed");
    expect(generateSpy).not.toHaveBeenCalled();
    expect(await balance(userId)).toBe(10);
  });

  it("leaves one ready and one failed, with balance reduced by exactly one price, when one of two variants fails", async () => {
    await grant(userId, 10, "opening balance");
    const creativeA = await makeCreative("offer");
    const creativeB = await makeCreative("problem");
    await reserve(userId, 1, creativeA.id);
    await reserve(userId, 1, creativeB.id);
    expect(await balance(userId)).toBe(8);

    await processCreativeJob(creativeA.id, { provider: new FakeProvider(), writeCopyFn: stubWriteCopy });

    const failing = new FakeProvider();
    failing.failNext(1);
    await processCreativeJob(creativeB.id, { provider: failing, writeCopyFn: stubWriteCopy });

    const [a, b] = await Promise.all([
      prisma.creative.findUniqueOrThrow({ where: { id: creativeA.id } }),
      prisma.creative.findUniqueOrThrow({ where: { id: creativeB.id } }),
    ]);
    expect(a.status).toBe("ready");
    expect(b.status).toBe("failed");
    expect(await balance(userId)).toBe(9);
  });
});

describe("POST /api/studio/generate", () => {
  function asUser(id: string) {
    requireApiSessionMock.mockResolvedValue({
      session: { userId: id, email: `${id}@test.local`, name: "Test User" },
      user: { id },
    });
  }

  it("returns 503 and reserves nothing when no provider is configured", async () => {
    asUser(userId);
    getImageProviderMock.mockReturnValue(null);
    hasAnthropicMock.mockReturnValue(true);
    await grant(userId, 10, "opening balance");

    const { POST } = await import("@/app/api/studio/generate/route");
    const res = await POST(
      new Request("http://localhost/api/studio/generate", {
        method: "POST",
        body: JSON.stringify({ productId, placement: "meta_feed_1x1", angles: ["offer"] }),
      }),
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("generation_unavailable");
    expect(await balance(userId)).toBe(10);
    expect(await prisma.creative.count({ where: { userId } })).toBe(0);
  });

  it("returns 404 and charges nothing when the brand isn't confirmed", async () => {
    asUser(userId);
    getImageProviderMock.mockReturnValue(new FakeProvider());
    hasAnthropicMock.mockReturnValue(true);
    await grant(userId, 10, "opening balance");
    await prisma.brand.update({ where: { id: brandId }, data: { confirmedAt: null } });

    const { POST } = await import("@/app/api/studio/generate/route");
    const res = await POST(
      new Request("http://localhost/api/studio/generate", {
        method: "POST",
        body: JSON.stringify({ productId, placement: "meta_feed_1x1", angles: ["offer"] }),
      }),
    );

    expect(res.status).toBe(404);
    expect(await balance(userId)).toBe(10);
  });

  it("reserves CREDIT_PRICE_PER_VARIANT per variant", async () => {
    asUser(userId);
    getImageProviderMock.mockReturnValue(new FakeProvider());
    hasAnthropicMock.mockReturnValue(true);
    await grant(userId, 10, "opening balance");
    const original = process.env.CREDIT_PRICE_PER_VARIANT;
    process.env.CREDIT_PRICE_PER_VARIANT = "3";

    try {
      const { POST } = await import("@/app/api/studio/generate/route");
      const res = await POST(
        new Request("http://localhost/api/studio/generate", {
          method: "POST",
          body: JSON.stringify({ productId, placement: "meta_feed_1x1", angles: ["offer", "proof"] }),
        }),
      );
      expect(res.status).toBe(200);
      const reserves = await prisma.creditLedger.findMany({ where: { userId, kind: "reserve" } });
      expect(reserves.map((r) => r.delta)).toEqual([-3, -3]);
    } finally {
      if (original === undefined) delete process.env.CREDIT_PRICE_PER_VARIANT;
      else process.env.CREDIT_PRICE_PER_VARIANT = original;
    }
  });

  it("returns 402 when credits are insufficient", async () => {
    asUser(userId);
    getImageProviderMock.mockReturnValue(new FakeProvider());
    hasAnthropicMock.mockReturnValue(true);
    // No grant — balance is 0.

    const { POST } = await import("@/app/api/studio/generate/route");
    const res = await POST(
      new Request("http://localhost/api/studio/generate", {
        method: "POST",
        body: JSON.stringify({ productId, placement: "meta_feed_1x1", angles: ["offer"] }),
      }),
    );

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("insufficient_credits");
    expect(await prisma.creative.count({ where: { userId } })).toBe(0);
  });
});
