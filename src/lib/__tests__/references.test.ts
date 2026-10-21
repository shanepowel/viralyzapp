import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasAnthropic } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { listReferences, saveUserReference } from "@/lib/references";
import { extractStructure } from "@/lib/structure";

let userId: string;

beforeEach(async () => {
  const id = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `refs-${id}@test.local`, name: "Test User", handle: `refs-${id}` },
  });
  userId = user.id;
});

afterEach(async () => {
  await prisma.reference.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("saveUserReference", () => {
  it("saving the same URL twice for one user returns the same row", async () => {
    const url = `https://shop.example.com/products/${randomUUID()}`;
    const first = await saveUserReference(userId, { url });
    const second = await saveUserReference(userId, { url });
    expect(second.id).toBe(first.id);

    const rows = await prisma.reference.findMany({ where: { userId, sourceRef: url } });
    expect(rows).toHaveLength(1);
  });

  it("records the source as user_url for a pasted link", async () => {
    const ref = await saveUserReference(userId, { url: "https://shop.example.com/products/x" });
    expect(ref.source).toBe("user_url");
  });

  it("throws when given neither a url nor a file", async () => {
    await expect(saveUserReference(userId, {})).rejects.toThrow();
  });
});

describe("extractStructure", () => {
  it("returns all-null fields (not guesses) when Anthropic is unavailable", async () => {
    expect(hasAnthropic()).toBe(false);
    const result = await extractStructure({ text: "Buy now, 50% off" });
    expect(result).toEqual({
      hookType: null,
      layout: null,
      offerType: null,
      cta: null,
      model: "unavailable",
    });
  });

  it("returns all-null fields when given neither an image nor text", async () => {
    const result = await extractStructure({});
    expect(result.hookType).toBeNull();
    expect(result.layout).toBeNull();
    expect(result.offerType).toBeNull();
    expect(result.cta).toBeNull();
  });
});

describe("listReferences", () => {
  async function makeOfficialReference(data: Partial<{ daysRunning: number | null; source: string }>) {
    return prisma.reference.create({
      data: {
        userId: null,
        source: data.source ?? "meta_eu_uk",
        sourceRef: randomUUID(),
        daysRunning: data.daysRunning ?? null,
      },
    });
  }

  afterEach(async () => {
    await prisma.reference.deleteMany({ where: { userId: null } });
  });

  it("excludes references whose daysRunning is null when filtering by minDaysRunning", async () => {
    const withDays = await makeOfficialReference({ daysRunning: 45 });
    await makeOfficialReference({ daysRunning: null });

    const { items } = await listReferences({ minDaysRunning: 30 });
    const ids = items.map((r) => r.id);
    expect(ids).toContain(withDays.id);
    expect(ids).toHaveLength(1);
  });

  it("never returns a Tier 2 (user-owned) reference, even when source matches", async () => {
    await saveUserReference(userId, { url: `https://shop.example.com/products/${randomUUID()}` });

    const { items } = await listReferences({ source: "user_url" });
    expect(items.every((r) => r.userId === null)).toBe(true);
    expect(items.some((r) => r.source === "user_url")).toBe(false);
  });
});
