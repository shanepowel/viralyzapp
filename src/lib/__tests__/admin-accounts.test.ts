import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { listAccountActivity } from "@/lib/admin-accounts";
import { grant } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

describe("listAccountActivity", () => {
  const userIds: string[] = [];

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  });

  it("counts credits, brands, and creatives without returning the ad itself", async () => {
    const id = randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: { email: `ops-${id}@test.local`, name: "Ops Seller", handle: `ops-${id}` },
    });
    userIds.push(user.id);
    await grant(user.id, 10, "opening balance");
    const brand = await prisma.brand.create({
      data: { userId: user.id, name: "Quiet brand", colors: ["#111111"] },
    });
    const product = await prisma.product.create({
      data: { brandId: brand.id, title: "Quiet product", imageUrls: [] },
    });
    await prisma.creative.create({
      data: {
        userId: user.id,
        brandId: brand.id,
        productId: product.id,
        placement: "meta_feed_1x1",
        angle: "offer",
        tag: `vz_${randomUUID().slice(0, 4)}`,
        status: "ready",
        headline: "Secret headline that must stay off the admin list",
        primaryText: "Secret primary text",
      },
    });

    const row = (await listAccountActivity(200)).find((account) => account.id === user.id);
    expect(row).toMatchObject({
      email: user.email,
      balance: 10,
      brandCount: 1,
      creatives: { pending: 0, generating: 0, ready: 1, failed: 0 },
    });
    expect(row?.lastCreativeAt).toBeInstanceOf(Date);
    expect(JSON.stringify(row)).not.toContain("Secret headline");
    expect(JSON.stringify(row)).not.toContain("primaryText");
  });
});
