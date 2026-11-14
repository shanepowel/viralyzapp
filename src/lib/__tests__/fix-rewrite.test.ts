import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { balance, grant, reserve } from "@/lib/credits";
import type { Copy, WriteCopyInput } from "@/lib/copy";
import { MAX_CHECKS_PER_AD, rewriteWording, undoRewrite } from "@/lib/fix";
import { processCreativeJob } from "@/lib/generation";
import { prisma } from "@/lib/prisma";
import { FakeProvider } from "@/lib/providers/fake";

vi.mock("@/lib/queue", () => ({ enqueueStudioJob: async () => true }));

/** 58 characters: over the 40-character feed headline limit. */
const LONG: Copy = {
  headline: "The softest oat cleanser you will ever put on your face ok",
  primaryText: "Hand-poured, made in small batches.",
  cta: "Shop now",
  imagePrompt: "A product on a neutral background, no text.",
};
const SHORT: Copy = { ...LONG, headline: "Softer mornings start here" };

let userId: string;
let creativeId: string;

beforeEach(async () => {
  const id = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `fix-${id}@test.local`, name: "Test User", handle: `fix-${id}` },
  });
  userId = user.id;
  const brand = await prisma.brand.create({
    data: { userId, name: "Test Brand", colors: ["#4b2e2e"], confirmedAt: new Date() },
  });
  const product = await prisma.product.create({
    data: { brandId: brand.id, title: "Test Product", imageUrls: ["https://cdn.example.com/p.jpg"], price: 38 },
  });
  const creative = await prisma.creative.create({
    data: {
      userId,
      brandId: brand.id,
      productId: product.id,
      placement: "meta_feed_1x1",
      angle: "offer",
      tag: `vz_${randomUUID().slice(0, 4)}`,
      status: "pending",
    },
  });
  creativeId = creative.id;
  await grant(userId, 10, "opening balance");
  await reserve(userId, 1, creativeId);
  await processCreativeJob(creativeId, { provider: new FakeProvider(), writeCopyFn: async () => LONG });
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("rewriteWording", () => {
  it("records where the text sits when an ad is first made", async () => {
    const [check] = await prisma.check.findMany({ where: { creativeId } });
    const layout = check.layout as { width: number; textBoxes: Array<{ role: string }> };
    expect(layout.width).toBe(1080);
    expect(layout.textBoxes.map((b) => b.role)).toContain("headline");
    expect(check.fix).toBeNull();
  });

  it("rewrites over the same image, clears the mark, spends no credit, and can be undone", async () => {
    const before = await prisma.creative.findUniqueOrThrow({ where: { id: creativeId } });
    const creditsBefore = await balance(userId);
    let asked: WriteCopyInput | null = null;

    const result = await rewriteWording(creativeId, userId, {
      writeCopyFn: async (input) => {
        asked = input;
        return SHORT;
      },
    });
    expect(result).toEqual({ ok: true });

    // The model was told the limit and what was wrong.
    expect(asked!.rewrite?.headlineMax).toBe(40);
    expect(asked!.rewrite?.problems.join(" ")).toMatch(/58 characters/);

    const after = await prisma.creative.findUniqueOrThrow({ where: { id: creativeId } });
    expect(after.headline).toBe(SHORT.headline);
    expect(after.backgroundKey).toBe(before.backgroundKey);
    expect(after.compositeKey).not.toBe(before.compositeKey);
    expect(await balance(userId)).toBe(creditsBefore);

    const checks = await prisma.check.findMany({ where: { creativeId }, orderBy: { computedAt: "desc" } });
    expect(checks).toHaveLength(2);
    const limits = (checks[0].factors as Array<{ id: string; passed?: boolean }>).find((f) => f.id === "char_limits");
    expect(limits?.passed).toBe(true);
    expect(checks[0].fix).toMatchObject({ kind: "rewrite", previous: { headline: LONG.headline } });

    expect(await undoRewrite(creativeId, userId)).toEqual({ ok: true });
    const undone = await prisma.creative.findUniqueOrThrow({ where: { id: creativeId } });
    expect(undone.headline).toBe(LONG.headline);
    expect(undone.compositeKey).toBe(before.compositeKey);
    expect(await prisma.check.count({ where: { creativeId } })).toBe(1);
    expect(await undoRewrite(creativeId, userId)).toEqual({ ok: false, error: "nothing_to_undo" });
  });

  it("refuses when nothing is marked, when the cap is reached, and for someone else's ad", async () => {
    expect(await rewriteWording(creativeId, "someone-else", { writeCopyFn: async () => SHORT })).toEqual({
      ok: false,
      error: "not_found",
    });

    // Still too long each time, so the mark stays and each rewrite counts.
    for (let i = 1; i < MAX_CHECKS_PER_AD; i++) {
      expect(await rewriteWording(creativeId, userId, { writeCopyFn: async () => LONG })).toEqual({ ok: true });
    }
    expect(await rewriteWording(creativeId, userId, { writeCopyFn: async () => LONG })).toEqual({
      ok: false,
      error: "rewrite_limit",
    });

    // Undo one, then a rewrite that clears it leaves nothing to fix.
    await undoRewrite(creativeId, userId);
    expect(await rewriteWording(creativeId, userId, { writeCopyFn: async () => SHORT })).toEqual({ ok: true });
    await undoRewrite(creativeId, userId);
    await undoRewrite(creativeId, userId);
    await undoRewrite(creativeId, userId);
    expect(await prisma.check.count({ where: { creativeId } })).toBe(1);
  });
});
