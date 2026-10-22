import { hasAnthropic } from "@/lib/env";

export type RefStructure = {
  hookType: string | null;
  layout: string | null;
  offerType: string | null;
  cta: string | null;
};

const ALL_NULL: RefStructure = { hookType: null, layout: null, offerType: null, cta: null };

const DEFAULT_MODEL = "claude-sonnet-5-5";

const PROMPT =
  'Analyze this ad creative and respond with JSON only (no prose), exactly this shape: ' +
  '{"hookType": string|null, "layout": string|null, "offerType": string|null, "cta": string|null}. ' +
  "Use null for anything you can't determine from what's given — never guess. " +
  'hookType: the opening attention-grab (e.g. "problem-agitation", "social-proof", "curiosity"). ' +
  'layout: the visual composition (e.g. "product-hero", "before-after", "lifestyle"). ' +
  'offerType: the commercial hook (e.g. "discount", "bundle", "free-shipping", "limited-time"). ' +
  "cta: the literal call-to-action text if visible, else a short label like \"shop-now\".";

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    const parsed = JSON.parse(candidate.trim());
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toStructure(raw: Record<string, unknown> | null): RefStructure {
  if (!raw) return { ...ALL_NULL };
  return {
    hookType: typeof raw.hookType === "string" ? raw.hookType : null,
    layout: typeof raw.layout === "string" ? raw.layout : null,
    offerType: typeof raw.offerType === "string" ? raw.offerType : null,
    cta: typeof raw.cta === "string" ? raw.cta : null,
  };
}

/**
 * Extracts hook/layout/offer/CTA structure from a reference ad's image
 * and/or text. Never guesses: every field is null whenever the model is
 * unavailable, the call fails, or a field can't be determined.
 */
export async function extractStructure(input: {
  imageUrl?: string;
  /** Raw image bytes, for uploads that have no public URL the model could fetch. */
  image?: { data: Buffer; mediaType: string };
  text?: string;
}): Promise<RefStructure & { model: string }> {
  if (!hasAnthropic() || (!input.imageUrl && !input.image && !input.text)) {
    return { ...ALL_NULL, model: "unavailable" };
  }

  const content: Array<Record<string, unknown>> = [];
  if (input.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType, data: input.image.data.toString("base64") },
    });
  } else if (input.imageUrl) {
    content.push({ type: "image", source: { type: "url", url: input.imageUrl } });
  }
  if (input.text) {
    content.push({ type: "text", text: input.text });
  }
  content.push({ type: "text", text: PROMPT });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) return { ...ALL_NULL, model: DEFAULT_MODEL };

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const textBlock = data.content?.find((block) => block.type === "text")?.text;
    if (!textBlock) return { ...ALL_NULL, model: DEFAULT_MODEL };

    return { ...toStructure(parseJsonObject(textBlock)), model: DEFAULT_MODEL };
  } catch {
    return { ...ALL_NULL, model: DEFAULT_MODEL };
  }
}

/**
 * What to store in Reference.structure for an extraction result: null when
 * nothing was learned (model unavailable, call failed, nothing determinable),
 * so the row stays eligible for a later extraction pass instead of being
 * marked "done" with all-null fields.
 */
export function structureToStore(
  result: RefStructure & { model: string },
): (RefStructure & { model: string }) | null {
  const learned = result.hookType ?? result.layout ?? result.offerType ?? result.cta;
  return learned == null ? null : result;
}
