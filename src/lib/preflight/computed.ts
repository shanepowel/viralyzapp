import type { CompositeLayout, FactorResult, Placement, TextBox } from "@/lib/preflight/types";

const WCAG_AA_NORMAL_TEXT = 4.5;
const MAX_TEXT_AREA_RATIO = 0.35;
const MAX_ASPECT_DEVIATION = 0.01;

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace(/^#/, "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, from 1 (identical colours) to 21 (black on white). */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(parseHexColor(fg));
  const l2 = relativeLuminance(parseHexColor(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function unavailable(id: string, label: string, kind: FactorResult["kind"], source?: string): FactorResult {
  return {
    id,
    label,
    kind,
    status: "unavailable",
    evidence: "No text boxes to evaluate.",
    source,
  };
}

export function checkContrast(layout: CompositeLayout, placement: Placement): FactorResult {
  if (layout.textBoxes.length === 0) {
    return unavailable("contrast", "Text contrast", "computed", placement.source);
  }

  let worst: { box: TextBox; ratio: number } | null = null;
  for (const box of layout.textBoxes) {
    const ratio = contrastRatio(box.fg, box.bg);
    if (!worst || ratio < worst.ratio) worst = { box, ratio };
  }

  const passed = worst!.ratio >= WCAG_AA_NORMAL_TEXT;
  return {
    id: "contrast",
    label: "Text contrast",
    kind: "computed",
    status: "scored",
    value: worst!.ratio,
    passed,
    evidence: `${worst!.box.role} contrast is ${worst!.ratio.toFixed(2)}:1 (needs ${WCAG_AA_NORMAL_TEXT}:1)`,
    source: placement.source,
  };
}

export function checkTextArea(layout: CompositeLayout, placement: Placement): FactorResult {
  if (layout.textBoxes.length === 0) {
    return unavailable("text_area", "Text-to-image area", "computed", placement.source);
  }

  const textArea = layout.textBoxes.reduce((sum, box) => sum + box.w * box.h, 0);
  const canvasArea = layout.width * layout.height;
  const ratio = canvasArea > 0 ? textArea / canvasArea : 0;
  const passed = ratio <= MAX_TEXT_AREA_RATIO;

  return {
    id: "text_area",
    label: "Text-to-image area",
    kind: "computed",
    status: "scored",
    value: ratio,
    passed,
    evidence: `Text covers ${(ratio * 100).toFixed(1)}% of the canvas (limit ${MAX_TEXT_AREA_RATIO * 100}%)`,
    source: placement.source,
  };
}

function intersectsSafeZone(box: TextBox, layout: CompositeLayout, placement: Placement): string | null {
  const { safeZone } = placement;
  if (box.y < safeZone.top) return "top";
  if (box.y + box.h > layout.height - safeZone.bottom) return "bottom";
  if (box.x < safeZone.left) return "left";
  if (box.x + box.w > layout.width - safeZone.right) return "right";
  return null;
}

export function checkSafeZone(layout: CompositeLayout, placement: Placement): FactorResult {
  if (layout.textBoxes.length === 0) {
    return unavailable("safe_zone", "Safe-zone overlap", "computed", placement.source);
  }

  const violations: string[] = [];
  for (const box of layout.textBoxes) {
    if (box.overflowed) {
      violations.push(`${box.role} overflowed its text box`);
      continue;
    }
    const edge = intersectsSafeZone(box, layout, placement);
    if (edge) violations.push(`${box.role} intersects the ${edge} safe zone`);
  }

  const passed = violations.length === 0;
  return {
    id: "safe_zone",
    label: "Safe-zone overlap",
    kind: "computed",
    status: "scored",
    value: violations.length,
    passed,
    evidence: passed ? "No safe-zone violations" : violations[0],
    source: placement.source,
  };
}

export function checkAspect(layout: CompositeLayout, placement: Placement): FactorResult {
  const actual = layout.width / layout.height;
  const target = placement.width / placement.height;
  const deviation = Math.abs(actual - target) / target;
  const passed = deviation <= MAX_ASPECT_DEVIATION;

  return {
    id: "aspect",
    label: "Aspect ratio",
    kind: "computed",
    status: "scored",
    value: deviation,
    passed,
    evidence: `Layout is ${actual.toFixed(3)}:1 vs placement's ${target.toFixed(3)}:1 (${(deviation * 100).toFixed(1)}% off)`,
    source: placement.source,
  };
}

/**
 * Headline length is measured from the composited layout. Primary text never
 * lands in the image, so it's passed in as copy and checked against the
 * placement's primaryMax alongside it.
 */
export function checkCharLimits(
  layout: CompositeLayout,
  placement: Placement,
  copy?: { primaryText: string },
): FactorResult {
  if (layout.textBoxes.length === 0) {
    return unavailable("char_limits", "Character limits", "computed", placement.source);
  }

  const headlines = layout.textBoxes.filter((box) => box.role === "headline");
  if (headlines.length === 0) {
    return unavailable("char_limits", "Character limits", "computed", placement.source);
  }

  let longest = headlines[0];
  for (const box of headlines) {
    if (box.text.length > longest.text.length) longest = box;
  }

  const headlineLength = longest.text.length;
  const parts = [`Headline is ${headlineLength} characters (limit ${placement.headlineMax})`];
  let passed = headlineLength <= placement.headlineMax;

  if (copy) {
    const primaryLength = copy.primaryText.length;
    parts.push(`primary text is ${primaryLength} (limit ${placement.primaryMax})`);
    passed = passed && primaryLength <= placement.primaryMax;
  }

  return {
    id: "char_limits",
    label: "Character limits",
    kind: "computed",
    status: "scored",
    value: headlineLength,
    passed,
    evidence: parts.join("; "),
    source: placement.source,
  };
}
