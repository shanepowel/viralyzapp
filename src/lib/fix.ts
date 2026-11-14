import type { Prisma } from "@/generated/prisma/client";
import type { Angle } from "@/lib/copy";
import { writeCopy } from "@/lib/copy";
import { hasAnthropic } from "@/lib/env";
import { CHECK_VERSION, formatPrice } from "@/lib/generation";
import { PLACEMENTS } from "@/lib/preflight/placements";
import { runPreflight } from "@/lib/preflight/index";
import type { FactorResult, Placement } from "@/lib/preflight/types";
import { prisma } from "@/lib/prisma";
import { readStoredObject, storeUpload } from "@/lib/storage";
import type { RefStructure } from "@/lib/structure";

/**
 * Fixing a marked ad without making a new image.
 *
 * The compositor already keeps text inside the safe zone and picks a colour
 * that clears contrast, so the marks that actually occur are about wording:
 * a headline that is too long, text that overflowed its box, or a phrase
 * that trips a policy rule. Those are fixed by rewriting the copy and
 * laying it over the same background. No image is generated, so no credit
 * is spent; the number of rewrites per ad is capped instead.
 */

/** Checks an ad may have in total: the original and three rewrites. */
export const MAX_CHECKS_PER_AD = 4;

export type FixError =
  | "not_found"
  | "not_ready"
  | "nothing_to_fix"
  | "rewrite_limit"
  | "unavailable"
  | "background_missing"
  | "nothing_to_undo";

type PreviousCopy = {
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  compositeKey: string | null;
  compositeUrl: string | null;
};

type FixRecord = { kind: "rewrite"; previous: PreviousCopy };

/** A failed, measured check that new wording can clear. */
export function isWordingMark(factor: FactorResult): boolean {
  if (factor.status !== "scored" || factor.passed !== false) return false;
  if (factor.kind === "rule") return true;
  if (factor.id === "char_limits") return true;
  // The safe-zone check also reports text that overflowed its box.
  return factor.id === "safe_zone" && /overflow/i.test(factor.evidence);
}

async function load(creativeId: string, userId: string) {
  return prisma.creative.findFirst({
    where: { id: creativeId, userId },
    include: {
      brand: true,
      product: true,
      reference: true,
      checks: { orderBy: { computedAt: "desc" } },
    },
  });
}

export async function rewriteWording(
  creativeId: string,
  userId: string,
  deps: { writeCopyFn?: typeof writeCopy } = {},
): Promise<{ ok: true } | { ok: false; error: FixError }> {
  const creative = await load(creativeId, userId);
  if (!creative) return { ok: false, error: "not_found" };
  if (creative.status !== "ready") return { ok: false, error: "not_ready" };
  if (!deps.writeCopyFn && !hasAnthropic()) return { ok: false, error: "unavailable" };

  const latest = creative.checks[0];
  const marks = ((latest?.factors ?? []) as unknown as FactorResult[]).filter(isWordingMark);
  if (marks.length === 0) return { ok: false, error: "nothing_to_fix" };
  if (creative.checks.length >= MAX_CHECKS_PER_AD) return { ok: false, error: "rewrite_limit" };

  if (!creative.backgroundKey) return { ok: false, error: "background_missing" };
  const background = await readStoredObject(creative.backgroundKey).catch(() => null);
  if (!background) return { ok: false, error: "background_missing" };

  const placement = PLACEMENTS[creative.placement as Placement["id"]];
  const copy = await (deps.writeCopyFn ?? writeCopy)({
    brand: creative.brand,
    product: creative.product,
    reference: (creative.reference?.structure as unknown as RefStructure | null) ?? null,
    angle: creative.angle as Angle,
    rewrite: {
      headlineMax: placement.headlineMax,
      primaryMax: placement.primaryMax,
      problems: marks.map((m) => m.evidence),
    },
  });

  const { composeAd } = await import("@/lib/compose");
  const { image, layout } = await composeAd({
    background,
    placement,
    headline: copy.headline,
    price: creative.product.price != null ? formatPrice(creative.product.price, creative.product.currency) : null,
    cta: copy.cta,
    brand: { colors: (creative.brand.colors as unknown as string[]) ?? [] },
  });
  const composite = await storeUpload({
    userId: creative.userId,
    contentId: `${creative.id}-composite-r${creative.checks.length}`,
    originalFilename: "composite.png",
    bytes: image,
    contentType: "image/png",
  });
  const { factors, headline, counted, total } = await runPreflight(layout, placement, {
    headline: copy.headline,
    primaryText: copy.primaryText,
    cta: copy.cta,
  });

  const fix: FixRecord = {
    kind: "rewrite",
    previous: {
      headline: creative.headline,
      primaryText: creative.primaryText,
      cta: creative.cta,
      compositeKey: creative.compositeKey,
      compositeUrl: creative.compositeUrl,
    },
  };
  await prisma.$transaction([
    prisma.creative.update({
      where: { id: creative.id },
      data: {
        headline: copy.headline,
        primaryText: copy.primaryText,
        cta: copy.cta,
        compositeKey: composite.storageKey,
        compositeUrl: composite.mediaUrl,
      },
    }),
    prisma.check.create({
      data: {
        creativeId: creative.id,
        checkVersion: CHECK_VERSION,
        factors: factors as unknown as Prisma.InputJsonValue,
        headline,
        headlineBasis: { counted, total },
        layout: layout as unknown as Prisma.InputJsonValue,
        fix: fix as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  return { ok: true };
}

/** Puts back the wording and image the last rewrite replaced. */
export async function undoRewrite(
  creativeId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: FixError }> {
  const creative = await load(creativeId, userId);
  if (!creative) return { ok: false, error: "not_found" };
  const latest = creative.checks[0];
  const fix = latest?.fix as unknown as FixRecord | null;
  if (!latest || !fix || fix.kind !== "rewrite") return { ok: false, error: "nothing_to_undo" };

  await prisma.$transaction([
    prisma.creative.update({ where: { id: creative.id }, data: fix.previous }),
    // The check before this one becomes the latest again.
    prisma.check.delete({ where: { id: latest.id } }),
  ]);
  return { ok: true };
}
