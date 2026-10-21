/**
 * fal.ai image provider adapter.
 *
 * Model: fal-ai/flux/schnell — chosen for low per-image cost and speed,
 * appropriate for generating several ad variants per request.
 * Price: fal.ai bills FLUX.1 [schnell] at ~$0.003 per megapixel; a 1080x1080
 * output (~1.17MP) is ~$0.0035/image. Checked against fal.ai's own model
 * pricing and a third-party aggregator on 2026-10-21 — third-party sources
 * disagreed on units (per-image vs per-megapixel) for other FLUX tiers, so
 * reconfirm against fal.ai's pricing page before relying on this figure for
 * real billing.
 */

import type { ImageProvider } from "@/lib/providers/types";

const MODEL = "fal-ai/flux/schnell";
const COST_PER_IMAGE = 0.0035;

type Aspect = "1:1" | "4:5" | "9:16";

// fal's image_size accepts named presets or {width,height}; we pass an
// explicit size since none of fal's presets are an exact 4:5 — the
// compositor (src/lib/compose.ts) re-crops to the placement's exact
// dimensions regardless, so this only needs to be a close starting point.
function aspectToImageSize(aspect: Aspect): { width: number; height: number } {
  switch (aspect) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "9:16":
      return { width: 1080, height: 1920 };
    default: {
      const exhaustive: never = aspect;
      throw new Error(`Unhandled aspect: ${exhaustive}`);
    }
  }
}

export class FalProvider implements ImageProvider {
  name = "fal";
  model = MODEL;
  costPerImage = COST_PER_IMAGE;

  async generate(input: { prompt: string; productImageUrl: string; aspect: Aspect }): Promise<Buffer> {
    const apiKey = process.env.FAL_KEY!.trim();
    const res = await fetch(`https://fal.run/${MODEL}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        image_size: aspectToImageSize(input.aspect),
        image_url: input.productImageUrl,
      }),
    });
    if (!res.ok) {
      throw new Error(`fal.ai request failed with status ${res.status}`);
    }

    const data = (await res.json()) as { images?: Array<{ url: string }> };
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) {
      throw new Error("fal.ai response had no image url");
    }

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download generated image: ${imageRes.status}`);
    }
    return Buffer.from(await imageRes.arrayBuffer());
  }
}
