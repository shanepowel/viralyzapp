import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { balance, grant, refund, reserve, settle } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

let userId: string;

beforeEach(async () => {
  const id = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `credits-${id}@test.local`, name: "Test User", handle: `credits-${id}` },
  });
  userId = user.id;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("credits", () => {
  it("balance equals sum of deltas", async () => {
    await grant(userId, 10, "opening balance");
    await grant(userId, 5, "bonus");
    expect(await balance(userId)).toBe(15);
  });

  it("reserve fails with insufficient when amount exceeds balance", async () => {
    await grant(userId, 5, "opening balance");
    const result = await reserve(userId, 10, randomUUID());
    expect(result).toEqual({ ok: false, reason: "insufficient" });
    expect(await balance(userId)).toBe(5);
  });

  it("refund restores exactly the reserved amount", async () => {
    await grant(userId, 10, "opening balance");
    const refId = randomUUID();
    const result = await reserve(userId, 4, refId);
    expect(result).toEqual({ ok: true });
    expect(await balance(userId)).toBe(6);

    await refund(refId);
    expect(await balance(userId)).toBe(10);
  });

  it("refund twice restores once", async () => {
    await grant(userId, 10, "opening balance");
    const refId = randomUUID();
    await reserve(userId, 4, refId);

    await refund(refId);
    await refund(refId);
    expect(await balance(userId)).toBe(10);
  });

  it("settle after refund is a no-op", async () => {
    await grant(userId, 10, "opening balance");
    const refId = randomUUID();
    await reserve(userId, 4, refId);
    await refund(refId);
    expect(await balance(userId)).toBe(10);

    await settle(refId);
    expect(await balance(userId)).toBe(10);

    const rows = await prisma.creditLedger.findMany({ where: { refId } });
    expect(rows.some((r) => r.kind === "settle")).toBe(false);
  });

  it("settling twice does not double-count", async () => {
    await grant(userId, 10, "opening balance");
    const refId = randomUUID();
    await reserve(userId, 4, refId);

    await settle(refId);
    await settle(refId);
    expect(await balance(userId)).toBe(6);
  });

  it("two concurrent reserves of 6 against balance 10 yield exactly one ok", async () => {
    await grant(userId, 10, "opening balance");
    const [a, b] = await Promise.all([
      reserve(userId, 6, randomUUID()),
      reserve(userId, 6, randomUUID()),
    ]);
    const okCount = [a, b].filter((r) => r.ok).length;
    expect(okCount).toBe(1);
    expect(await balance(userId)).toBe(4);
  });
});
