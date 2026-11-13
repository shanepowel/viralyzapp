import { PLACEMENTS } from "@/lib/preflight/placements";
import type { Placement } from "@/lib/preflight/types";

export type FactorResultDTO = {
  id: string;
  label: string;
  kind: "computed" | "rule" | "model";
  status: "scored" | "unavailable";
  value?: number;
  passed?: boolean;
  evidence: string;
};

export type CreativeDTO = {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  referenceId?: string | null;
  status: "pending" | "generating" | "ready" | "failed";
  headline: string | null;
  primaryText?: string | null;
  cta?: string | null;
  compositeUrl: string | null;
  aiGenerated: boolean;
  createdAt?: string;
  checks: Array<{
    headline: number | null;
    headlineBasis: { counted: number; total: number };
    factors: FactorResultDTO[];
  }>;
};

export const PLACEMENT_ORDER = ["meta_feed_1x1", "meta_feed_4x5", "story_9x16", "tiktok_9x16"] as const;
export type PlacementId = (typeof PLACEMENT_ORDER)[number];

export const PLACEMENT_LABELS: Record<string, string> = {
  meta_feed_1x1: "Meta feed 1:1",
  meta_feed_4x5: "Meta feed 4:5",
  story_9x16: "Story 9:16",
  tiktok_9x16: "TikTok 9:16",
};

/** CSS aspect-ratio per placement, so a proof has the shape the ad will have. */
export const PLACEMENT_RATIO: Record<string, string> = {
  meta_feed_1x1: "1 / 1",
  meta_feed_4x5: "4 / 5",
  story_9x16: "9 / 16",
  tiktok_9x16: "9 / 16",
};

export const ANGLE_ORDER = ["offer", "problem", "proof", "demo"] as const;
export type AngleId = (typeof ANGLE_ORDER)[number];

export const ANGLE_LABELS: Record<string, string> = {
  offer: "Offer",
  problem: "Problem",
  proof: "Proof",
  demo: "Demo",
};

export const ANGLE_HINTS: Record<string, string> = {
  offer: "Lead with the deal",
  problem: "Name the pain first",
  proof: "Show why to believe it",
  demo: "Show the product working",
};

export function placementPixels(placement: string): string | null {
  const spec = PLACEMENTS[placement as Placement["id"]];
  return spec ? `${spec.width} × ${spec.height}` : null;
}

export function safeZonePct(placement: string): { top: number; right: number; bottom: number; left: number } | null {
  const spec = PLACEMENTS[placement as Placement["id"]];
  if (!spec) return null;
  const { safeZone, width, height } = spec;
  if (safeZone.top + safeZone.right + safeZone.bottom + safeZone.left === 0) return null;
  return {
    top: (safeZone.top / height) * 100,
    right: (safeZone.right / width) * 100,
    bottom: (safeZone.bottom / height) * 100,
    left: (safeZone.left / width) * 100,
  };
}

/**
 * The rule a mark cites. The numbers are fixed so "rule 2" always means the
 * safe zone, on every ad and in every list.
 */
const RULES: Record<string, { no: number; name: string }> = {
  contrast: { no: 1, name: "Contrast" },
  safe_zone: { no: 2, name: "Safe zone" },
  aspect: { no: 3, name: "Aspect ratio" },
  char_limits: { no: 4, name: "Characters" },
  text_area: { no: 6, name: "Text area" },
};
const POLICY_RULE = { no: 5, name: "Policy" };

export function ruleFor(factor: FactorResultDTO): { no: number; name: string } {
  if (factor.kind === "rule") return POLICY_RULE;
  return RULES[factor.id] ?? { no: 0, name: factor.label };
}

export function cleanLabel(factor: FactorResultDTO): string {
  return factor.label.replace(/ \(AI-assessed\)$/, "");
}

export type Mark = { n: number; factor: FactorResultDTO; rule: { no: number; name: string }; blocking: boolean };

export type Proof = {
  verdict: "checking" | "failed" | "blocked" | "fix" | "cleared" | "unchecked";
  /** Things that must change, numbered in the order they are listed. */
  marks: Mark[];
  cleared: FactorResultDTO[];
  /** AI opinions: shown in grey, never counted as a pass or a fail. */
  estimates: FactorResultDTO[];
  notChecked: FactorResultDTO[];
};

/** Reads a creative's latest check the way the desk shows it. */
export function readProof(creative: CreativeDTO): Proof {
  const factors = creative.checks[0]?.factors ?? [];
  const measured = factors.filter((f) => f.status === "scored" && f.kind !== "model");
  const marks: Mark[] = measured
    .filter((f) => !f.passed)
    // Policy first: it is the one kind of mark that stops a download.
    .sort((a, b) => Number(b.kind === "rule") - Number(a.kind === "rule"))
    .map((factor, i) => ({ n: i + 1, factor, rule: ruleFor(factor), blocking: factor.kind === "rule" }));
  const proof = {
    marks,
    cleared: measured.filter((f) => f.passed),
    estimates: factors.filter((f) => f.status === "scored" && f.kind === "model"),
    notChecked: factors.filter((f) => f.status === "unavailable"),
  };

  let verdict: Proof["verdict"];
  if (creative.status === "pending" || creative.status === "generating") verdict = "checking";
  else if (creative.status === "failed") verdict = "failed";
  else if (marks.some((m) => m.blocking)) verdict = "blocked";
  else if (marks.length > 0) verdict = "fix";
  else if (measured.length > 0) verdict = "cleared";
  else verdict = "unchecked";
  return { verdict, ...proof };
}

export function verdictWords(proof: Proof): string {
  switch (proof.verdict) {
    case "checking":
      return "Checking";
    case "failed":
      return "Not made";
    case "blocked":
      return "Blocked";
    case "fix":
      return `${proof.marks.length} to fix`;
    case "cleared":
      return "Cleared";
    case "unchecked":
      return "Not checked";
  }
}

type RawCreative = {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  referenceId?: string | null;
  status: string;
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  compositeUrl: string | null;
  aiGenerated: boolean;
  checks: Array<{ headline: number | null; headlineBasis: unknown; factors: unknown }>;
};

/** API and database rows to the shape the screens use. */
export function toCreativeDTO(raw: RawCreative): CreativeDTO {
  return {
    id: raw.id,
    tag: raw.tag,
    angle: raw.angle,
    placement: raw.placement,
    productId: raw.productId,
    referenceId: raw.referenceId ?? null,
    status: raw.status as CreativeDTO["status"],
    headline: raw.headline,
    primaryText: raw.primaryText,
    cta: raw.cta,
    compositeUrl: raw.compositeUrl,
    aiGenerated: raw.aiGenerated,
    checks: raw.checks.map((c) => ({
      headline: c.headline,
      headlineBasis: c.headlineBasis as { counted: number; total: number },
      factors: c.factors as FactorResultDTO[],
    })),
  };
}
