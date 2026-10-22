import { aggregate } from "@/lib/preflight/aggregate";
import {
  checkAspect,
  checkCharLimits,
  checkContrast,
  checkSafeZone,
  checkTextArea,
} from "@/lib/preflight/computed";
import { assessHook } from "@/lib/preflight/model-factor";
import { checkPolicy } from "@/lib/preflight/rules";
import type { CompositeLayout, FactorResult, Placement } from "@/lib/preflight/types";

export type PreflightCopy = { headline: string; primaryText: string; cta: string };

/** Runs every computed, rule, and model factor and aggregates the headline number. */
export async function runPreflight(
  layout: CompositeLayout,
  placement: Placement,
  copy: PreflightCopy,
): Promise<{ factors: FactorResult[]; headline: number | null; counted: number; total: number }> {
  const factors: FactorResult[] = [
    checkContrast(layout, placement),
    checkTextArea(layout, placement),
    checkSafeZone(layout, placement),
    checkAspect(layout, placement),
    checkCharLimits(layout, placement, copy),
    ...checkPolicy(copy),
    await assessHook({ headline: copy.headline }),
  ];

  const { headline, counted, total } = aggregate(factors);
  return { factors, headline, counted, total };
}
