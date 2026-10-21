import type { FactorResult } from "@/lib/preflight/types";

const MIN_SCORED_FOR_HEADLINE = 4;

/**
 * Headline number: the average pass rate of scored computed/rule factors,
 * as a 0-100 integer. Model factors never count toward it — they're shown
 * separately until calibration (Spearman correlation against real CTR)
 * justifies folding one in. `headline` is null until at least 4 factors
 * are actually scored, so a thin check set never produces a falsely
 * precise-looking number.
 */
export function aggregate(factors: FactorResult[]): {
  headline: number | null;
  counted: number;
  total: number;
} {
  const eligible = factors.filter((f) => f.kind === "computed" || f.kind === "rule");
  const scored = eligible.filter((f) => f.status === "scored");
  const counted = scored.length;
  const total = eligible.length;

  if (counted < MIN_SCORED_FOR_HEADLINE) {
    return { headline: null, counted, total };
  }

  const passed = scored.filter((f) => f.passed === true).length;
  const headline = Math.round((passed / counted) * 100);
  return { headline, counted, total };
}
