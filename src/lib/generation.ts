import type { Prisma } from "@/generated/prisma/client";
import type { Angle } from "@/lib/copy";
import { writeCopy } from "@/lib/copy";
import { refund, settle } from "@/lib/credits";
import { PLACEMENTS } from "@/lib/preflight/placements";
import { runPreflight } from "@/lib/preflight/index";
import type { Placement } from "@/lib/preflight/types";
import { prisma } from "@/lib/prisma";
import { composeAd } from "@/lib/compose";
import { getImageProvider } from "@/lib/providers";
import type { ImageProvider } from "@/lib/providers/types";
import { storeUpload } from "@/lib/storage";
import type { RefStructure } from "@/lib/structure";

/** Price per generated variant, in credits. Config, not provider code. */
export const CREDIT_PRICE_PER_VARIANT = 1;

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
};

/**
 * Generates one creative end to end: copy, background image, composite,
 * pre-flight, then settles or refunds the credit reserved for it at
 * /api/studio/generate time. Idempotent — a creative already `ready` is
 * skipped rather than regenerated and re-billed.
 */
export async function processCreativeJob(creativeId: string, deps: GenerationDeps = {}): Promise<void> {
  const creative = await prisma.creative.findUniqueOrThrow({
    where: { id: creativeId },
    include: { brand: true, product: true, reference: true },
  });
  if (creative.status === "ready") return;

  const provider = deps.provider !== undefined ? deps.provider : getImageProvider();
  if (!provider) {
    await prisma.creative.update({ where: { id: creativeId }, data: { status: "failed" } });
    await refund(creativeId);
    return;
  }

  await prisma.creative.update({ where: { id: creativeId }, data: { status: "generating" } });

  try {
    const writeCopyFn = deps.writeCopyFn ?? writeCopy;
    const referenceStructure = (creative.reference?.structure as unknown as RefStructure | null) ?? null;

    const copy = await writeCopyFn({
      brand: creative.brand,
      product: creative.product,
      reference: referenceStructure,
      angle: creative.angle as Angle,
    });

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
        creativeId,
        checkVersion: CHECK_VERSION,
        factors: factors as unknown as Prisma.InputJsonValue,
        headline,
        headlineBasis: { counted, total },
      },
    });

    await prisma.creative.update({
      where: { id: creativeId },
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

    await settle(creativeId);
  } catch {
    await prisma.creative.update({ where: { id: creativeId }, data: { status: "failed" } });
    await refund(creativeId);
  }
}
