import type { FactorResult } from "@/lib/preflight/types";

export type AdCopy = { headline: string; primaryText: string; cta: string };

type Rule = {
  id: string;
  label: string;
  ruleText: string;
  pattern: RegExp;
};

/**
 * One rule per policy category, matched against the combined copy. Each
 * pattern is a narrow, documented example of the category — not an attempt
 * to catch every phrasing a real reviewer would flag.
 */
const RULES: Rule[] = [
  {
    id: "before_after_claim",
    label: "Before/after claim",
    ruleText:
      "Don't present an exaggerated or implied unrealistic outcome through a before/after framing.",
    pattern: /\bbefore\s*(?:[/&]|and)\s*after\b/i,
  },
  {
    id: "health_claim",
    label: "Health claim",
    ruleText:
      "Don't make a health claim asserting a specific, quantified result (e.g. weight loss) within a guaranteed timeframe.",
    pattern: /\blose\s+\d+\s*(?:kg|kgs|lbs?|pounds?)\s+in\s+\d+\s*(?:days?|weeks?)\b/i,
  },
  {
    id: "income_claim",
    label: "Income claim",
    ruleText:
      "Don't promise a specific, guaranteed income or earnings figure over a time period.",
    pattern: /\b(?:make|earn)\s+\$\s*\d[\d,]*\s*(?:a|per)\s*(?:day|week|month|year)\b/i,
  },
  {
    id: "personal_attribute_claim",
    label: "Personal-attribute claim",
    ruleText:
      "Don't directly assert or imply a reader's personal attribute, health condition, or financial status.",
    pattern: /\b(?:are you|you're|you are)\s+(?:depressed|overweight|broke|struggling with debt|tired of being (?:fat|lonely))\b/i,
  },
];

/** Combines a copy's fields and checks each policy rule against all of it. */
export function checkPolicy(copy: AdCopy): FactorResult[] {
  const combined = `${copy.headline} ${copy.primaryText} ${copy.cta}`;

  return RULES.map((rule) => {
    const match = combined.match(rule.pattern);
    const passed = !match;
    return {
      id: rule.id,
      label: rule.label,
      kind: "rule" as const,
      status: "scored" as const,
      passed,
      evidence: passed ? `No match for: ${rule.ruleText}` : `"${match![0]}" — ${rule.ruleText}`,
    };
  });
}
