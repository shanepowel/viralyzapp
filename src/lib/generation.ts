import type { Prisma } from "@/generated/prisma/client";
import type { Angle } from "@/lib/copy";
import { writeCopy } from "@/lib/copy";
import { refund, settle } from "@/lib/credits";
import { hasAnthropic, hasRedis } from "@/lib/env";
import { moderateImagePrompt } from "@/lib/moderation";
import { PLACEMENTS } from "@/lib/preflight/placements";
import { runPreflight } from "@/lib/preflight/index";
import type { Placement } from "@/lib/preflight/types";
import { prisma } from "@/lib/prisma";
import { composeAd } from "@/lib/compose";
import { getImageProvider } from "@/lib/providers";
import type { ImageProvider } from "@/lib/providers/types";
import { storeUpload } from "@/lib/storage";
import type { RefStructure } from "@/lib/structure";

/**
 * Whether a Generate request could succeed right now: an image provider and
 * the copy model are both configured. Screens use it to disable Generate up
 * front; the generate route refuses with 503 when it's false.
 */
export function generationAvailable(): boolean {
  return getImageProvider() !== null && hasAnthropic();
}

/** Bump only in a versioned offline release — never per user. */
const CHECK_VERSION = 1;

function placementToAspect(id: Placement["id"]): "1:1" | "4:5" | "9:16" {
  switch (id) {
    case "meta_feed_1x1":
      return "1:1";
    case "meta_feed_4x5":
      return "4:5";
    case "story_9x16":
    case "tiktok_9x16":
      return "9:16";
    default: {
      const exhaustive: never = id;
      throw new Error(`Unhandled placement: ${exhaustive}`);
    }
  }
}

function formatPrice(price: unknown, currency: string | null): string {
  const amount = Number(price);
  const symbol = !currency || currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export type GenerationDeps = {
  /** Overrides getImageProvider() — pass a FakeProvider in tests. */
  provider?: ImageProvider | null;
  /** Overrides the real (Anthropic-backed) writeCopy — stub it in tests. */
  writeCopyFn?: typeof writeCopy;
  /** Overrides the stuck-job deadline. Tests use a few milliseconds. */
  timeoutMs?: number;
};

/**
 * A variant still pending or generating after this long is stuck. Without
 * Redis the job runs inside the request, and that work dies with the
 * isolate — nothing else would fail it or return the credit.
 */
export const GENERATION_TIMEOUT_MS = 3 * 60 * 1000;

const OPEN_STATUSES = ["pending", "generating"] as const;

/** Marks an in-flight creative failed and returns its reserved credit. Idempotent. */
async function failAndRefund(creativeId: string): Promise<boolean> {
  const failed = await prisma.creative.updateMany({
    where: { id: creativeId, status: { in: [...OPEN_STATUSES] } },
    data: { status: "failed" },
  });
  if (failed.count === 0) return false;
  await refund(creativeId);
  return true;
}

/**
 * Fails one creative that has sat in pending or generating past the deadline,
 * and refunds its credit. No-op when Redis is configured (the worker owns
 * those jobs) or the creative is already finished or still inside the window.
 */
export async function failStuckCreative(creativeId: string, now = new Date()): Promise<boolean> {
  if (hasRedis()) return false;
  const creative = await prisma.creative.findUnique({
    where: { id: creativeId },
    select: { status: true, updatedAt: true },
  });
  if (!creative) return false;
  if (creative.status !== "pending" && creative.status !== "generating") return false;
  if (now.getTime() - creative.updatedAt.getTime() < GENERATION_TIMEOUT_MS) return false;
  return failAndRefund(creativeId);
}

/** Same sweep for every open creative still on a seller's screen. */
export async function failStuckCreativesForUser(userId: string, now = new Date()): Promise<number> {
  if (hasRedis()) return 0;
  const cutoff = new Date(now.getTime() - GENERATION_TIMEOUT_MS);
  const stuck = await prisma.creative.findMany({
    where: { userId, status: { in: [...OPEN_STATUSES] }, updatedAt: { lt: cutoff } },
    select: { id: true },
  });
  let failed = 0;
  for (const row of stuck) {
    if (await failAndRefund(row.id)) failed += 1;
  }
  return failed;
}

/**
 * Generates one creative end to end: copy, background image, composite,
 * pre-flight, then settles or refunds the credit reserved for it at
 * /api/studio/generate time. Idempotent — a creative already `ready` or
 * `failed` is skipped rather than regenerated and re-billed.
 */
export async function processCreativeJob(creativeId: string, deps: GenerationDeps = {}): Promise<void> {
  const creative = await prisma.creative.findUniqueOrThrow({
    where: { id: creativeId },
    include: { brand: true, product: true, reference: true },
  });
  // Both outcomes are terminal. A failed creative has already been
  // refunded, so generating it now would hand out a free variant; retrying
  // creates a fresh creative with its own reservation instead.
  if (creative.status === "ready" || creative.status === "failed") return;

  const provider = deps.provider !== undefined ? deps.provider : getImageProvider();
  if (!provider) {
    await failAndRefund(creativeId);
    return;
  }

  await prisma.creative.updateMany({
    where: { id: creativeId, status: { in: [...OPEN_STATUSES] } },
    data: { status: "generating" },
  });

  const timeoutMs = deps.timeoutMs ?? GENERATION_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      runGeneration(creative, provider, deps),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("generation timed out")), timeoutMs);
      }),
    ]);
  } catch {
    // The in-flight run may still finish. Its ready-write only lands while
    // the row is still open, so a timeout that already failed it wins.
    await failAndRefund(creativeId);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runGeneration(
  creative: Prisma.CreativeGetPayload<{ include: { brand: true; product: true; reference: true } }>,
  provider: ImageProvider,
  deps: GenerationDeps,
): Promise<void> {
  const writeCopyFn = deps.writeCopyFn ?? writeCopy;
  const referenceStructure = (creative.reference?.structure as unknown as RefStructure | null) ?? null;

  const copy = await writeCopyFn({
    brand: creative.brand,
    product: creative.product,
    reference: referenceStructure,
    angle: creative.angle as Angle,
  });

  // Copy and the image prompt are model-written from user-supplied brand
  // text, so the prompt is screened before it reaches the image provider.
  // A blocked prompt fails the variant (and refunds) rather than
  // generating something we can't stand behind.
  const moderation = moderateImagePrompt(copy.imagePrompt);
  if (!moderation.ok) {
    throw new Error(`Image prompt blocked: ${moderation.reason}`);
  }

  const placement = PLACEMENTS[creative.placement as Placement["id"]];
  const productImageUrls = (creative.product.imageUrls as unknown as string[]) ?? [];

  const backgroundBuffer = await provider.generate({
    prompt: copy.imagePrompt,
    productImageUrl: productImageUrls[0] ?? "",
    aspect: placementToAspect(placement.id),
  });

  const background = await storeUpload({
    userId: creative.userId,
    contentId: creative.id,
    originalFilename: "background.png",
    bytes: backgroundBuffer,
    contentType: "image/png",
  });

  const price = creative.product.price != null ? formatPrice(creative.product.price, creative.product.currency) : null;
  const brandColors = (creative.brand.colors as unknown as string[]) ?? [];

  const { image, layout } = await composeAd({
    background: backgroundBuffer,
    placement,
    headline: copy.headline,
    price,
    cta: copy.cta,
    brand: { colors: brandColors },
  });

  const composite = await storeUpload({
    userId: creative.userId,
    contentId: `${creative.id}-composite`,
    originalFilename: "composite.png",
    bytes: image,
    contentType: "image/png",
  });

  const { factors, headline, counted, total } = await runPreflight(layout, placement, {
    headline: copy.headline,
    primaryText: copy.primaryText,
    cta: copy.cta,
  });

  await prisma.check.create({
    data: {
      creativeId: creative.id,
      checkVersion: CHECK_VERSION,
      factors: factors as unknown as Prisma.InputJsonValue,
      headline,
      headlineBasis: { counted, total },
    },
  });

  const finished = await prisma.creative.updateMany({
    where: { id: creative.id, status: { in: [...OPEN_STATUSES] } },
    data: {
      headline: copy.headline,
      primaryText: copy.primaryText,
      cta: copy.cta,
      backgroundKey: background.storageKey,
      backgroundUrl: background.mediaUrl,
      compositeKey: composite.storageKey,
      compositeUrl: composite.mediaUrl,
      status: "ready",
      provider: provider.name,
      providerModel: provider.model,
      aiGenerated: true,
    },
  });
  // A timeout, or the stuck-job sweep, already failed and refunded this row.
  if (finished.count === 0) return;
  await settle(creative.id);
}
