import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasAnthropic } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  getReferenceForUser,
  listReferences,
  listUserReferences,
  saveUserReference,
} from "@/lib/references";
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

  const PRODUCT_PAGE = `<html><head>
    <meta property="og:title" content="Spring sale: 30% off candles">
    <meta property="og:image" content="https://cdn.example.com/ad.jpg">
  </head></html>`;

  const LEARNED = { hookType: "discount", layout: "product-hero", offerType: "discount", cta: "shop-now", model: "test-model" };

  it("extracts structure from a pasted page's title and lead image", async () => {
    const extract = vi.fn().mockResolvedValue(LEARNED);
    const fetchPage = vi.fn().mockResolvedValue({ body: PRODUCT_PAGE });
    const url = `https://shop.example.com/ads/${randomUUID()}`;

    const ref = await saveUserReference(userId, { url }, { extract, fetchPage });

    expect(fetchPage).toHaveBeenCalledWith(url);
    expect(extract).toHaveBeenCalledWith({
      text: "Spring sale: 30% off candles",
      imageUrl: "https://cdn.example.com/ad.jpg",
    });
    expect(ref.structure).toMatchObject({ hookType: "discount", model: "test-model" });
  });

  it("extracts structure from an upload's own bytes", async () => {
    const extract = vi.fn().mockResolvedValue(LEARNED);
    const image = { data: Buffer.from("fake-png"), mediaType: "image/png" };
    const file = { storageKey: `${userId}/ref-${randomUUID()}.png`, mediaUrl: "/uploads/x.png", backend: "local" as const };

    const ref = await saveUserReference(userId, { file, image }, { extract });

    expect(ref.source).toBe("user_upload");
    expect(extract).toHaveBeenCalledWith({ image });
    expect(ref.structure).toMatchObject({ cta: "shop-now" });
  });

  it("still saves the reference when the page can't be fetched", async () => {
    const extract = vi.fn();
    const fetchPage = vi.fn().mockRejectedValue(new Error("blocked_address"));

    const ref = await saveUserReference(userId, { url: "https://shop.example.com/down" }, { extract, fetchPage });

    expect(ref.id).toBeDefined();
    expect(ref.structure).toBeNull();
    expect(extract).not.toHaveBeenCalled();
  });

  it("doesn't re-extract a reference that already has structure", async () => {
    const extract = vi.fn().mockResolvedValue(LEARNED);
    const fetchPage = vi.fn().mockResolvedValue({ body: PRODUCT_PAGE });
    const url = `https://shop.example.com/ads/${randomUUID()}`;

    await saveUserReference(userId, { url }, { extract, fetchPage });
    await saveUserReference(userId, { url }, { extract, fetchPage });

    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe("listUserReferences and getReferenceForUser", () => {
  let otherUserId: string;

  beforeEach(async () => {
    const id = randomUUID().slice(0, 8);
    const other = await prisma.user.create({
      data: { email: `refs-other-${id}@test.local`, name: "Other", handle: `refs-other-${id}` },
    });
    otherUserId = other.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
  });

  it("lists only the user's own references", async () => {
    const mine = await saveUserReference(userId, { url: `https://a.example.com/${randomUUID()}` });
    await saveUserReference(otherUserId, { url: `https://b.example.com/${randomUUID()}` });

    const items = await listUserReferences(userId);
    expect(items.map((r) => r.id)).toEqual([mine.id]);
  });

  it("returns shared references and your own, but never someone else's", async () => {
    const mine = await saveUserReference(userId, { url: `https://a.example.com/${randomUUID()}` });
    const theirs = await saveUserReference(otherUserId, { url: `https://b.example.com/${randomUUID()}` });
    const shared = await prisma.reference.create({
      data: { userId: null, source: "meta_eu_uk", sourceRef: randomUUID() },
    });

    expect((await getReferenceForUser(mine.id, userId))?.id).toBe(mine.id);
    expect((await getReferenceForUser(shared.id, userId))?.id).toBe(shared.id);
    expect(await getReferenceForUser(theirs.id, userId)).toBeNull();

    await prisma.reference.delete({ where: { id: shared.id } });
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
