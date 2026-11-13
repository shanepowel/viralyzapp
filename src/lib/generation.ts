import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Angle } from "@/lib/copy";
import { writeCopy } from "@/lib/copy";
import { refund, settle } from "@/lib/credits";
import { hasAnthropic } from "@/lib/env";
import { moderateImagePrompt } from "@/lib/moderation";
import { PLACEMENTS } from "@/lib/preflight/placements";
import { runPreflight } from "@/lib/preflight/index";
import type { Placement } from "@/lib/preflight/types";
import { prisma } from "@/lib/prisma";
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
 * One attempt's hang limit. A dead request does not wait this long: the
 * lease below is what lets the next poll pick the job back up.
 */
export const GENERATION_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * How long a generating row counts as owned. The worker refreshes this while
 * it is alive. Redis is optional — when the request isolate dies, the lease
 * goes stale and the next read resumes the job instead of refunding it.
 */
export const GENERATION_LEASE_MS = 75 * 1000;

/** Attempts before an open variant is failed and its credit returned. */
export const GENERATION_MAX_ATTEMPTS = 3;

const OPEN_STATUSES = ["pending", "generating"] as const;

const HEARTBEAT_MS = 20_000;

/** Marks an in-flight creative failed and returns its reserved credit. Idempotent. */
async function failAndRefund(creativeId: string, runId?: string): Promise<boolean> {
  const failed = await prisma.creative.updateMany({
    where: {
      id: creativeId,
      status: { in: [...OPEN_STATUSES] },
      ...(runId ? { runId } : {}),
    },
    data: { status: "failed", runId: null },
  });
  if (failed.count === 0) return false;
  await refund(creativeId);
  return true;
}

function leaseFresh(updatedAt: Date, now: Date) {
  return now.getTime() - updatedAt.getTime() < GENERATION_LEASE_MS;
}

export type ContinueResult = "skipped" | "resumed" | "refunded";

/**
 * Resumes a variant whose worker has gone, or refunds it once the attempt
 * cap is spent. A fresh lease means someone is still generating, so this
 * leaves that row alone. Works with or without Redis.
 */
export async function continueCreative(
  creativeId: string,
  now = new Date(),
  run: (creativeId: string) => Promise<void> = processCreativeJob,
): Promise<ContinueResult> {
  const creative = await prisma.creative.findUnique({
    where: { id: creativeId },
    select: { status: true, updatedAt: true, attempts: true },
  });
  if (!creative) return "skipped";
  if (creative.status !== "pending" && creative.status !== "generating") return "skipped";
  if (creative.status === "generating" && leaseFresh(creative.updatedAt, now)) return "skipped";
  if (creative.attempts >= GENERATION_MAX_ATTEMPTS) {
    return (await failAndRefund(creativeId)) ? "refunded" : "skipped";
  }
  await run(creativeId);
  return "resumed";
}

/** Same decision for every open creative on a seller's screen. */
export async function continueOpenCreativesForUser(
  userId: string,
  run: (creativeId: string) => Promise<void> = processCreativeJob,
): Promise<void> {
  const open = await prisma.creative.findMany({
    where: { userId, status: { in: [...OPEN_STATUSES] } },
    select: { id: true },
  });
  for (const row of open) {
    await continueCreative(row.id, new Date(), run);
  }
}

/** Picks up the oldest open variants. The cron uses this so a closed tab still finishes. */
export async function continueOpenCreatives(now = new Date(), limit = 2): Promise<number> {
  const staleBefore = new Date(now.getTime() - GENERATION_LEASE_MS);
  const rows = await prisma.creative.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "generating", updatedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let handled = 0;
  for (const row of rows) {
    const result = await continueCreative(row.id, now);
    if (result !== "skipped") handled += 1;
  }
  return handled;
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

  const runId = randomUUID();
  const staleBefore = new Date(Date.now() - GENERATION_LEASE_MS);
  const claimed = await prisma.creative.updateMany({
    where: {
      id: creativeId,
      attempts: { lt: GENERATION_MAX_ATTEMPTS },
      OR: [{ status: "pending" }, { status: "generating", updatedAt: { lt: staleBefore } }],
    },
    data: { status: "generating", runId, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;

  const timeoutMs = deps.timeoutMs ?? GENERATION_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    heartbeat = setInterval(() => {
      void prisma.creative
        .updateMany({
          where: { id: creativeId, runId, status: "generating" },
          data: { status: "generating" },
        })
        .catch(() => {});
    }, HEARTBEAT_MS);
    heartbeat.unref?.();
    await Promise.race([
      runGeneration(creative, provider, deps, runId),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("generation timed out")), timeoutMs);
      }),
    ]);
  } catch (err) {
    const owned = await prisma.creative.findUnique({
      where: { id: creativeId },
      select: { attempts: true, runId: true },
    });
    if (!owned || owned.runId !== runId) return;
    const timedOut = err instanceof Error && err.message === "generation timed out";
    if (timedOut && owned.attempts < GENERATION_MAX_ATTEMPTS) {
      // Release the claim so the next poll can try again. The run id no
      // longer matches, so this attempt cannot settle after the release.
      await prisma.creative.updateMany({
        where: { id: creativeId, runId, status: { in: [...OPEN_STATUSES] } },
        data: { status: "pending", runId: null },
      });
      return;
    }
    await failAndRefund(creativeId, runId);
  } finally {
    if (timer) clearTimeout(timer);
    if (heartbeat) clearInterval(heartbeat);
  }
}

async function runGeneration(
  creative: Prisma.CreativeGetPayload<{ include: { brand: true; product: true; reference: true } }>,
  provider: ImageProvider,
  deps: GenerationDeps,
  runId: string,
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

  // Loaded on demand: sharp is a native module, and a static import here made
  // every page that reads generation state (Studio, Creatives) fail to load
  // when the binary was missing from the function bundle.
  const { composeAd } = await import("@/lib/compose");
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

  const finished = await prisma.creative.updateMany({
    where: { id: creative.id, runId, status: { in: [...OPEN_STATUSES] } },
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
  // A later attempt owns the row, or this one was released. Do not settle.
  if (finished.count === 0) return;
  await prisma.check.create({
    data: {
      creativeId: creative.id,
      checkVersion: CHECK_VERSION,
      factors: factors as unknown as Prisma.InputJsonValue,
      headline,
      headlineBasis: { counted, total },
    },
  });
  await settle(creative.id);
}
