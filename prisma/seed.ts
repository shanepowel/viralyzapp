import "dotenv/config";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { demoLoginEmail } from "../src/lib/env";

const url = process.env.DATABASE_URL?.trim();
if (!url || url.startsWith("file:")) {
  throw new Error("Set DATABASE_URL to a Postgres connection string before seeding.");
}

/**
 * This seed DELETES every table before inserting. Running it against production
 * would wipe real data and previously also planted a known admin password.
 */
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  throw new Error(
    "Refusing to seed in production (this seed deletes all rows). " +
      "Set ALLOW_PRODUCTION_SEED=true only if you are certain.",
  );
}

/**
 * Admin password comes from the environment. If unset, a random one is generated and
 * printed once. Never hardcode a credential here — the previous constant shipped in
 * the repo and granted admin on production.
 */
const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || randomBytes(18).toString("base64url");
const adminPasswordWasGenerated = !process.env.SEED_ADMIN_PASSWORD?.trim();
const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@viralyz.com").trim().toLowerCase();

const pool = new Pool({
  connectionString: url,
  ssl:
    url.includes("sslmode=require") || url.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  await prisma.passwordResetToken.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.performanceRow.deleteMany();
  await prisma.performanceImport.deleteMany();
  await prisma.check.deleteMany();
  await prisma.creative.deleteMany();
  await prisma.reference.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.creditLedger.deleteMany();
  await prisma.platform.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const demoHash = await bcrypt.hash(randomBytes(18).toString("base64url"), 10);
  const testerHash = await bcrypt.hash(randomBytes(18).toString("base64url"), 10);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminHash,
      name: "Admin",
      handle: "admin",
      plan: "unlimited",
      role: "admin",
      onboardingDone: true,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.creditLedger.create({
    data: { userId: admin.id, delta: 999, kind: "grant", note: "opening balance" },
  });

  /**
   * DEMO ACCOUNT — doubles as the one-click DEMO_LOGIN target (see
   * demoLoginEmail in src/lib/env.ts). Carries a confirmed brand, a product,
   * a few Tier 1 references, some generated creatives with pre-flight checks,
   * and an imported performance file — enough to exercise Discover, Studio,
   * Creatives, Results, and Account without any external API keys.
   */
  const demo = await prisma.user.create({
    data: {
      email: demoLoginEmail(),
      passwordHash: demoHash,
      name: "Demo Seller",
      handle: "demoseller",
      plan: "credits",
      role: "user",
      onboardingDone: true,
      emailVerifiedAt: new Date(),
    },
  });

  const brand = await prisma.brand.create({
    data: {
      userId: demo.id,
      name: "Pantry & Co",
      sourceUrl: "https://pantryand.co",
      colors: ["#1B3A2F", "#F2994A", "#FAFAF7"],
      logoUrl: null,
      voice: "Warm, direct, a little playful. Short sentences.",
      confirmedAt: new Date(),
    },
  });

  const product = await prisma.product.create({
    data: {
      brandId: brand.id,
      title: "Cast Iron Starter Kit",
      price: 68,
      currency: "USD",
      imageUrls: ["https://picsum.photos/seed/castiron/800/800"],
      url: "https://pantryand.co/products/cast-iron-starter-kit",
    },
  });

  const reference = await prisma.reference.create({
    data: {
      source: "meta_eu_uk",
      sourceRef: "meta-demo-001",
      advertiser: "Rival Kitchenware Co",
      category: "home_kitchen",
      firstSeenAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(),
      daysRunning: 40,
      variantCount: 3,
      country: "GB",
      structure: { hookType: "problem", layout: "product_hero", offerType: "percent_off", cta: "Shop now" },
      thumbnailUrl: "https://picsum.photos/seed/reference1/600/600",
    },
  });

  const placements = ["meta_feed_1x1", "meta_feed_4x5", "story_9x16"] as const;
  const creatives: { id: string; tag: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const tag = `vz_dem${i}`;
    const creative = await prisma.creative.create({
      data: {
        userId: demo.id,
        brandId: brand.id,
        productId: product.id,
        referenceId: reference.id,
        placement: placements[i],
        angle: ["offer", "problem", "proof"][i],
        headline: ["Cook like it's cast iron season", "Still using flimsy pans?", "40,000 home cooks switched"][i],
        primaryText: "Pre-seasoned, oven-safe, built to outlast the kitchen it's in.",
        cta: "Shop now",
        tag,
        aiGenerated: true,
        status: "ready",
        provider: "fake",
        providerModel: "fake-v1",
      },
    });
    creatives.push({ id: creative.id, tag });

    await prisma.check.create({
      data: {
        creativeId: creative.id,
        checkVersion: 1,
        factors: [
          { id: "contrast", label: "Text contrast", kind: "computed", status: "scored", passed: true, value: 1, evidence: "4.6:1 against sampled background" },
          { id: "text_area", label: "Text coverage", kind: "computed", status: "scored", passed: true, value: 1, evidence: "18% of frame" },
          { id: "safe_zone", label: "Safe zone", kind: "computed", status: "scored", passed: true, value: 1, evidence: "All text inside safe zone" },
          { id: "aspect", label: "Aspect ratio", kind: "computed", status: "scored", passed: true, value: 1, evidence: "Matches placement spec" },
          { id: "char_limits", label: "Character limits", kind: "rule", status: "scored", passed: i !== 1, value: i !== 1 ? 1 : 0, evidence: i !== 1 ? "Within limits" : "Headline exceeds 40 chars" },
          { id: "policy_health", label: "Health claims", kind: "rule", status: "scored", passed: true, value: 1, evidence: "No personal health claims found" },
          { id: "hook", label: "Hook strength", kind: "model", status: "scored", value: 72, evidence: "Model-assessed hook strength" },
        ],
        headline: i !== 1 ? 100 : 83,
        headlineBasis: { counted: 6, total: 6 },
      },
    });
  }

  const perfImport = await prisma.performanceImport.create({
    data: {
      userId: demo.id,
      platform: "meta",
      filename: "meta-ads-manager-demo.csv",
      rowsTotal: 3,
      rowsMatched: 2,
      rowsRejected: [],
    },
  });
  await prisma.performanceRow.createMany({
    data: [
      {
        importId: perfImport.id,
        creativeId: creatives[0].id,
        adName: `Cast iron hero — ${creatives[0].tag}`,
        impressions: 48210,
        clicks: 612,
        spend: 214.5,
        purchases: 19,
        revenue: 1292,
        matched: true,
      },
      {
        importId: perfImport.id,
        creativeId: creatives[2].id,
        adName: `Proof angle — ${creatives[2].tag}`,
        impressions: 31005,
        clicks: 298,
        spend: 162.1,
        purchases: 7,
        revenue: 476,
        matched: true,
      },
      {
        importId: perfImport.id,
        creativeId: null,
        adName: "Untagged legacy ad",
        impressions: 9120,
        clicks: 41,
        spend: 38.2,
        purchases: null,
        revenue: null,
        matched: false,
      },
    ],
  });

  // Opening grant, a reserve+settle for the generated creatives above, and one
  // refund — so the Account screen's ledger history has something to show.
  await prisma.creditLedger.create({
    data: { userId: demo.id, delta: 50, kind: "grant", note: "opening balance" },
  });
  for (const c of creatives) {
    await prisma.creditLedger.create({
      data: { userId: demo.id, delta: -1, kind: "reserve", refId: c.id },
    });
    await prisma.creditLedger.create({
      data: { userId: demo.id, delta: 0, kind: "settle", refId: c.id, note: "settled" },
    });
  }
  await prisma.creditLedger.create({
    data: { userId: demo.id, delta: 1, kind: "refund", refId: "demo-refund-example", note: "refunded" },
  });

  // Tester account — onboarding not yet done, so the brand-setup banner shows.
  const tester = await prisma.user.create({
    data: {
      email: "tester@viralyz.com",
      passwordHash: testerHash,
      name: "Beta Tester",
      handle: "betatester",
      plan: "credits",
      role: "user",
      onboardingDone: false,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.creditLedger.create({
    data: { userId: tester.id, delta: 10, kind: "grant", note: "opening balance" },
  });

  const inviteCodes = ["VLZDEMO1", "VLZDEMO2", "VLZDEMO3", "VLZDEMO4", "VLZDEMO5"];
  for (const code of inviteCodes) {
    await prisma.invite.create({
      data: {
        code,
        maxUses: 1,
        note: "Seed invite",
        createdBy: admin.id,
        expiresAt: new Date(Date.now() + 90 * 86400000),
      },
    });
  }

  console.log("Seeded Viralyz beta data");
  console.log(`Admin account: ${adminEmail} (role: admin)`);
  if (adminPasswordWasGenerated) {
    console.log(`Generated password (shown once): ${adminPassword}`);
    console.log("Set SEED_ADMIN_PASSWORD to choose your own.");
  } else {
    console.log("Password: from SEED_ADMIN_PASSWORD");
  }
  console.log(`Demo account (one-click sign-in target): ${demoLoginEmail()}`);
  console.log("Tester account password was randomised — use password reset to access it.");
  console.log("Sample invites:", inviteCodes.join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
