import type { Brand, Product } from "@/generated/prisma/client";
import { hasAnthropic } from "@/lib/env";
import type { RefStructure } from "@/lib/structure";

export type Angle = "offer" | "problem" | "proof" | "demo";

export type Copy = {
  headline: string;
  primaryText: string;
  cta: string;
  imagePrompt: string;
};

const DEFAULT_MODEL = "claude-sonnet-5-5";

const ANGLE_GUIDANCE: Record<Angle, string> = {
  offer: "Lead with the concrete offer or deal — price, bundle, or promotion.",
  problem: "Open with the problem or frustration the product solves.",
  proof: "Lead with credibility — reviews, usage, or specificity that builds trust.",
  demo: "Make the headline concrete about what the product does, as if showing it in use.",
};

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  try {
    const parsed = JSON.parse((fenced ? fenced[1] : text).trim());
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type WriteCopyInput = {
  brand: Pick<Brand, "name" | "voice">;
  product: Pick<Product, "title" | "price" | "currency">;
  reference: RefStructure | null;
  angle: Angle;
};

/**
 * Writes headline/primaryText/cta/imagePrompt via Anthropic. Callers (the
 * /api/studio/generate route) are responsible for the generation_unavailable
 * 503 when Anthropic isn't configured — this throws rather than silently
 * degrading, since copy with no model behind it isn't a smaller version of
 * the feature, it's a different, unrequested one (fabricated ad copy).
 */
export async function writeCopy(input: WriteCopyInput): Promise<Copy> {
  if (!hasAnthropic()) {
    throw new Error("writeCopy requires ANTHROPIC_API_KEY to be set");
  }

  const priceLine = input.product.price != null ? ` (${input.product.currency ?? ""}${Number(input.product.price).toFixed(2)})` : "";
  const referenceLine = input.reference
    ? `Reference ad structure: hook "${input.reference.hookType ?? "unknown"}", layout "${input.reference.layout ?? "unknown"}", offer "${input.reference.offerType ?? "unknown"}", cta style "${input.reference.cta ?? "unknown"}".`
    : "No reference ad is available — write from the brand and product alone.";

  const prompt = [
    'Write static-ad copy for this brand and product. Respond with JSON only, no prose, exactly this shape: {"headline": string, "primaryText": string, "cta": string, "imagePrompt": string}.',
    `Brand: ${input.brand.name}${input.brand.voice ? ` — voice: ${input.brand.voice}` : ""}.`,
    `Product: ${input.product.title}${priceLine}.`,
    referenceLine,
    `Angle: ${input.angle}. ${ANGLE_GUIDANCE[input.angle]}`,
    "imagePrompt describes only the background image to generate: no text or words rendered in the image, and never a real person's likeness.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic copy request failed with status ${res.status}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((block) => block.type === "text")?.text;
  if (!textBlock) {
    throw new Error("Anthropic response had no text content");
  }

  const parsed = parseJsonObject(textBlock);
  if (
    !parsed ||
    typeof parsed.headline !== "string" ||
    typeof parsed.primaryText !== "string" ||
    typeof parsed.cta !== "string" ||
    typeof parsed.imagePrompt !== "string"
  ) {
    throw new Error("Anthropic response did not match the expected copy shape");
  }

  return {
    headline: parsed.headline,
    primaryText: parsed.primaryText,
    cta: parsed.cta,
    imagePrompt: parsed.imagePrompt,
  };
}
