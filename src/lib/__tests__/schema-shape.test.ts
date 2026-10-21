import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newTag } from "@/lib/tags";
import { prisma } from "@/lib/prisma";

let userId: string;
let brandId: string;
let productId: string;

beforeEach(async () => {
  const id = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `tags-${id}@test.local`, name: "Test User", handle: `tags-${id}` },
  });
  userId = user.id;
  const brand = await prisma.brand.create({
    data: { userId, name: "Test Brand", colors: [] },
  });
  brandId = brand.id;
  const product = await prisma.product.create({
    data: { brandId, title: "Test Product", imageUrls: [] },
  });
  productId = product.id;
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("newTag", () => {
  it("returns vz_ plus 4 lowercase base36 characters", async () => {
    const tag = await newTag();
    expect(tag).toMatch(/^vz_[a-z0-9]{4}$/);
  });

  // 1,000 sequential round trips against a real DB genuinely take a few
  // seconds; the longer timeout is for that, not a logic bug.
  it("is unique across 1,000 calls against a seeded set", async () => {
    const tags = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const tag = await newTag();
      expect(tags.has(tag)).toBe(false);
      tags.add(tag);
      await prisma.creative.create({
        data: { userId, brandId, productId, placement: "meta_feed_1x1", angle: "offer", tag },
      });
    }
    expect(tags.size).toBe(1000);
  }, 20_000);
});
