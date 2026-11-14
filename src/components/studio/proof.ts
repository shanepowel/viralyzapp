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

export type LayoutBoxDTO = {
  role: "headline" | "price" | "cta";
  x: number;
  y: number;
  w: number;
  h: number;
  overflowed: boolean;
  text: string;
};

export type LayoutDTO = { width: number; height: number; textBoxes: LayoutBoxDTO[] };

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
    /** Where each piece of text sits. Absent on ads checked before this was recorded. */
    layout?: LayoutDTO | null;
    /** True when this check came from a wording rewrite, which can be undone. */
    rewritten?: boolean;
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

export type Mark = {
  n: number;
  factor: FactorResultDTO;
  rule: { no: number; name: string };
  blocking: boolean;
  /** The text box the mark points at, when the problem is on the image. */
  box: LayoutBoxDTO | null;
  /** New wording can clear it without making a new image. */
  wording: boolean;
};

/** Same rule as the server (lib/fix): the marks a rewrite can clear. */
function isWordingMark(f: FactorResultDTO): boolean {
  if (f.kind === "rule" || f.id === "char_limits") return true;
  return f.id === "safe_zone" && /overflow/i.test(f.evidence);
}

/** Finds the text box a failed check is about, from what the check reported. */
function boxFor(f: FactorResultDTO, layout: LayoutDTO | null | undefined): LayoutBoxDTO | null {
  const boxes = layout?.textBoxes ?? [];
  if (boxes.length === 0) return null;
  const byRole = (role: string) => boxes.find((b) => b.role === role) ?? null;
  if (f.id === "char_limits") return byRole("headline");
  if (f.id === "contrast" || f.id === "safe_zone") {
    const role = f.evidence.match(/^(headline|price|cta)\b/i)?.[1]?.toLowerCase();
    return role ? byRole(role) : null;
  }
  if (f.kind === "rule") {
    // Evidence starts with the matched phrase in quotes. Primary text is not on the image.
    const phrase = f.evidence.match(/^"([^"]+)"/)?.[1]?.toLowerCase();
    return phrase ? (boxes.find((b) => b.text.toLowerCase().includes(phrase)) ?? null) : null;
  }
  return null;
}

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
    .map((factor, i) => ({
      n: i + 1,
      factor,
      rule: ruleFor(factor),
      blocking: factor.kind === "rule",
      box: boxFor(factor, creative.checks[0]?.layout),
      wording: isWordingMark(factor),
    }));
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
  checks: Array<{ headline: number | null; headlineBasis: unknown; factors: unknown; layout?: unknown; fix?: unknown }>;
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
      layout: (c.layout as LayoutDTO | null | undefined) ?? null,
      rewritten: Boolean(c.fix),
    })),
  };
}

export type FixAction = "rewrite" | "undo";

const FIX_ERRORS: Record<string, string> = {
  nothing_to_fix: "There is no wording problem on this ad to rewrite.",
  nothing_to_undo: "There is no rewrite to undo.",
  rewrite_limit: "This ad has been rewritten three times. Make it again to start fresh.",
  unavailable: "Rewriting is switched off: the copy service is not configured.",
  background_missing: "The image behind this ad is no longer stored, so it cannot be rewritten. Make it again instead.",
  not_ready: "This ad is still being made.",
};

/** Rewrites the wording over the same image, or undoes the last rewrite. Spends no credit. */
export async function requestFix(
  id: string,
  action: FixAction,
): Promise<{ creative: CreativeDTO } | { error: string }> {
  try {
    const res = await fetch(`/api/studio/creatives/${id}/fix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) return { error: FIX_ERRORS[data.error] ?? "Could not change this ad. Nothing was charged." };
    return { creative: toCreativeDTO(data.creative) };
  } catch {
    return { error: "Could not change this ad. Nothing was charged." };
  }
}
