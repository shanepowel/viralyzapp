import { readFileSync } from "node:fs";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import { contrastRatio } from "@/lib/preflight/computed";
import type { CompositeLayout, Placement, TextBox } from "@/lib/preflight/types";

const FLOOR_FONT_SIZE = 28;
const LINE_HEIGHT_MULT = 1.2;
// Heuristic average glyph width as a fraction of font size. We have no real
// font-metrics engine available, so wrapping is approximate, not
// pixel-perfect — good enough to decide when text needs to shrink or has
// genuinely run out of room, which is all the floor/overflow behavior needs.
const CHAR_WIDTH_FACTOR = 0.55;

const BOX_WIDTH_FRACTION = 0.84;
const BOX_GAP = 24;
// Fixed (not placement-scaled) vertical budgets, tuned so a realistic
// headline (well under our own headlineMax values) fits comfortably while
// a wildly oversized one is flagged rather than silently shrunk forever.
const HEADLINE_BOX_HEIGHT = 120;
const PRICE_BOX_HEIGHT = 80;
const CTA_BOX_HEIGHT = 80;
const HEADLINE_START_SIZE = 64;
const PRICE_START_SIZE = 48;
const CTA_START_SIZE = 40;

let fontsCache: { latin: string; arabic: string } | null = null;
function loadFontsBase64(): { latin: string; arabic: string } {
  if (fontsCache) return fontsCache;
  const fontsDir = path.join(process.cwd(), "assets", "fonts");
  fontsCache = {
    latin: readFileSync(path.join(fontsDir, "NotoSans-Regular.ttf")).toString("base64"),
    arabic: readFileSync(path.join(fontsDir, "NotoSansArabic-Regular.ttf")).toString("base64"),
  };
  return fontsCache;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_FACTOR;
}

function wrapLines(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  // Hard-wrap any single "word" that alone exceeds maxWidth — a long run
  // with no spaces (or a script that doesn't use them) would otherwise
  // produce one unbounded line.
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * CHAR_WIDTH_FACTOR)));
  const wrapped: string[] = [];
  for (const line of lines) {
    if (estimateTextWidth(line, fontSize) <= maxWidth) {
      wrapped.push(line);
      continue;
    }
    for (let i = 0; i < line.length; i += maxChars) {
      wrapped.push(line.slice(i, i + maxChars));
    }
  }
  return wrapped;
}

type Fit = { fontSize: number; lines: string[]; overflowed: boolean };

function fitText(text: string, maxWidth: number, maxHeight: number, startSize: number): Fit {
  for (let fontSize = startSize; fontSize >= FLOOR_FONT_SIZE; fontSize -= 2) {
    const lines = wrapLines(text, fontSize, maxWidth);
    if (lines.length * fontSize * LINE_HEIGHT_MULT <= maxHeight) {
      return { fontSize, lines, overflowed: false };
    }
  }
  return { fontSize: FLOOR_FONT_SIZE, lines: wrapLines(text, FLOOR_FONT_SIZE, maxWidth), overflowed: true };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

async function sampleRegionColor(
  image: Sharp,
  region: { x: number; y: number; w: number; h: number },
  canvasWidth: number,
  canvasHeight: number,
): Promise<string> {
  const left = Math.max(0, Math.min(canvasWidth - 1, Math.round(region.x)));
  const top = Math.max(0, Math.min(canvasHeight - 1, Math.round(region.y)));
  const width = Math.max(1, Math.min(canvasWidth - left, Math.round(region.w)));
  const height = Math.max(1, Math.min(canvasHeight - top, Math.round(region.h)));

  const stats = await image.clone().extract({ left, top, width, height }).stats();
  // Grayscale (1 channel) or grayscale+alpha (2) sources don't gain extra
  // bands just by requesting an sRGB colourspace — read whatever channels
  // are actually there instead of assuming 3+.
  const [c0, c1, c2] = stats.channels;
  const [r, g, b] = stats.channels.length >= 3 ? [c0, c1, c2] : [c0, c0, c0];
  return rgbToHex(r.mean, g.mean, b.mean);
}

/**
 * Picks the brand colour with the best WCAG contrast against the sampled
 * background, as long as at least one clears the AA threshold (4.5:1).
 * Otherwise falls back to whichever of black/white contrasts better —
 * never a brand colour that would be unreadable.
 */
function pickTextColor(brandColors: string[], bgHex: string): string {
  const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  let best: { color: string; ratio: number } | null = null;
  for (const color of brandColors) {
    if (!hexPattern.test(color)) continue;
    const ratio = contrastRatio(color, bgHex);
    if (ratio >= 4.5 && (!best || ratio > best.ratio)) best = { color, ratio };
  }
  if (best) return best.color;

  const blackRatio = contrastRatio("#000000", bgHex);
  const whiteRatio = contrastRatio("#ffffff", bgHex);
  return whiteRatio >= blackRatio ? "#ffffff" : "#000000";
}

function renderTextBox(fit: Fit, box: { x: number; y: number; w: number; h: number }, color: string): string {
  if (fit.lines.length === 0) return "";
  const lineHeight = fit.fontSize * LINE_HEIGHT_MULT;
  const totalHeight = fit.lines.length * lineHeight;
  const cx = box.x + box.w / 2;
  // Baseline of the first line, vertically centering the whole block
  // within the box (or starting at the top if it overflowed past box.h).
  const firstBaseline = box.y + Math.max(0, (box.h - totalHeight) / 2) + fit.fontSize;

  const tspans = fit.lines
    .map((line, i) => `<tspan x="${cx}" y="${firstBaseline + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text font-size="${fit.fontSize}" fill="${color}" text-anchor="middle">${tspans}</text>`;
}

export type ComposeInput = {
  background: Buffer;
  placement: Placement;
  headline: string;
  price: string | null;
  cta: string;
  brand: { colors: string[] };
};

export type ComposeResult = { image: Buffer; layout: CompositeLayout };

export async function composeAd(input: ComposeInput): Promise<ComposeResult> {
  const { placement } = input;
  // Normalize to flattened RGB regardless of the source's colour space —
  // a grayscale, palette, or alpha-carrying background would otherwise
  // give sampleRegionColor fewer than 3 channels to read.
  const base = sharp(input.background)
    .resize(placement.width, placement.height, { fit: "cover", position: "centre" })
    .flatten({ background: "#ffffff" })
    .toColorspace("srgb");

  const safeLeft = placement.safeZone.left;
  const safeTop = placement.safeZone.top;
  const safeWidth = placement.width - placement.safeZone.left - placement.safeZone.right;
  const safeHeight = placement.height - placement.safeZone.top - placement.safeZone.bottom;

  const boxWidth = safeWidth * BOX_WIDTH_FRACTION;
  const boxX = safeLeft + (safeWidth - boxWidth) / 2;

  const headlineBox = { x: boxX, y: safeTop, w: boxWidth, h: HEADLINE_BOX_HEIGHT };
  const priceBox = {
    x: boxX,
    y: headlineBox.y + HEADLINE_BOX_HEIGHT + BOX_GAP,
    w: boxWidth,
    h: PRICE_BOX_HEIGHT,
  };
  const ctaBox = {
    x: boxX,
    y: safeTop + safeHeight - CTA_BOX_HEIGHT,
    w: boxWidth,
    h: CTA_BOX_HEIGHT,
  };

  const headlineBg = await sampleRegionColor(base, headlineBox, placement.width, placement.height);
  const ctaBg = await sampleRegionColor(base, ctaBox, placement.width, placement.height);
  const priceBg =
    input.price !== null
      ? await sampleRegionColor(base, priceBox, placement.width, placement.height)
      : null;

  const headlineColor = pickTextColor(input.brand.colors, headlineBg);
  const ctaColor = pickTextColor(input.brand.colors, ctaBg);
  const priceColor = priceBg ? pickTextColor(input.brand.colors, priceBg) : null;

  const headlineFit = fitText(input.headline, headlineBox.w, headlineBox.h, HEADLINE_START_SIZE);
  const ctaFit = fitText(input.cta, ctaBox.w, ctaBox.h, CTA_START_SIZE);
  const priceFit = input.price !== null ? fitText(input.price, priceBox.w, priceBox.h, PRICE_START_SIZE) : null;

  const fonts = loadFontsBase64();
  const svgParts = [
    `<svg width="${placement.width}" height="${placement.height}" xmlns="http://www.w3.org/2000/svg">`,
    "<defs><style>",
    `@font-face { font-family: 'ComposeSans'; src: url('data:font/ttf;base64,${fonts.latin}') format('truetype'); }`,
    `@font-face { font-family: 'ComposeSansArabic'; src: url('data:font/ttf;base64,${fonts.arabic}') format('truetype'); }`,
    "text { font-family: 'ComposeSans', 'ComposeSansArabic', sans-serif; }",
    "</style></defs>",
    renderTextBox(headlineFit, headlineBox, headlineColor),
    priceFit && priceColor ? renderTextBox(priceFit, priceBox, priceColor) : "",
    renderTextBox(ctaFit, ctaBox, ctaColor),
    "</svg>",
  ];
  const svg = svgParts.join("");

  const image = await base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();

  const textBoxes: TextBox[] = [
    {
      role: "headline",
      x: headlineBox.x,
      y: headlineBox.y,
      w: headlineBox.w,
      h: headlineBox.h,
      fg: headlineColor,
      bg: headlineBg,
      overflowed: headlineFit.overflowed,
      text: input.headline,
    },
    ...(input.price !== null && priceFit && priceColor
      ? [
          {
            role: "price" as const,
            x: priceBox.x,
            y: priceBox.y,
            w: priceBox.w,
            h: priceBox.h,
            fg: priceColor,
            bg: priceBg!,
            overflowed: priceFit.overflowed,
            text: input.price,
          },
        ]
      : []),
    {
      role: "cta",
      x: ctaBox.x,
      y: ctaBox.y,
      w: ctaBox.w,
      h: ctaBox.h,
      fg: ctaColor,
      bg: ctaBg,
      overflowed: ctaFit.overflowed,
      text: input.cta,
    },
  ];

  return {
    image,
    layout: { width: placement.width, height: placement.height, textBoxes },
  };
}
