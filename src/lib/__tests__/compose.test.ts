import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { composeAd } from "@/lib/compose";
import { PLACEMENTS } from "@/lib/preflight/placements";

async function solidBackground(width: number, height: number, rgb: [number, number, number]): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  })
    .png()
    .toBuffer();
}

describe("composeAd", () => {
  it("outputs dimensions equal to the placement", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [200, 200, 200]);
    const { image } = await composeAd({
      background,
      placement,
      headline: "Shop the new collection",
      price: "$38.00",
      cta: "Shop now",
      brand: { colors: ["#4b2e2e"] },
    });
    const meta = await sharp(image).metadata();
    expect(meta.width).toBe(placement.width);
    expect(meta.height).toBe(placement.height);
  });

  it("matches the story placement's dimensions too", async () => {
    const placement = PLACEMENTS.story_9x16;
    const background = await solidBackground(placement.width, placement.height, [30, 30, 30]);
    const { image } = await composeAd({
      background,
      placement,
      headline: "Hand-poured soy candles",
      price: null,
      cta: "Shop now",
      brand: { colors: [] },
    });
    const meta = await sharp(image).metadata();
    expect(meta.width).toBe(placement.width);
    expect(meta.height).toBe(placement.height);
  });

  it("flags a 200-character headline as overflowed without throwing", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const headline = "x".repeat(200);

    const { layout } = await composeAd({
      background,
      placement,
      headline,
      price: "$38.00",
      cta: "Shop now",
      brand: { colors: ["#4b2e2e"] },
    });

    const headlineBox = layout.textBoxes.find((b) => b.role === "headline");
    expect(headlineBox?.overflowed).toBe(true);
  });

  it("does not overflow a realistic, well-under-limit headline", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);

    const { layout } = await composeAd({
      background,
      placement,
      headline: "Hand-poured soy candles, made in small batches",
      price: "$38.00",
      cta: "Shop now",
      brand: { colors: ["#4b2e2e"] },
    });

    const headlineBox = layout.textBoxes.find((b) => b.role === "headline");
    expect(headlineBox?.overflowed).toBe(false);
  });

  it("returns a buffer for an emoji headline", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const { image } = await composeAd({
      background,
      placement,
      headline: "🎉 Big sale 🎉",
      price: "$38.00",
      cta: "Shop now",
      brand: { colors: [] },
    });
    expect(Buffer.isBuffer(image)).toBe(true);
    expect(image.length).toBeGreaterThan(0);
  });

  it("returns a buffer for an Arabic headline", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const { image } = await composeAd({
      background,
      placement,
      headline: "تسوق المجموعة الجديدة",
      price: "$38.00",
      cta: "تسوق الآن",
      brand: { colors: [] },
    });
    expect(Buffer.isBuffer(image)).toBe(true);
    expect(image.length).toBeGreaterThan(0);
  });

  it("produces no price box when price is null", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const { layout } = await composeAd({
      background,
      placement,
      headline: "Shop the new collection",
      price: null,
      cta: "Shop now",
      brand: { colors: [] },
    });
    expect(layout.textBoxes.some((b) => b.role === "price")).toBe(false);
  });

  it("includes a price box when price is given", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const { layout } = await composeAd({
      background,
      placement,
      headline: "Shop the new collection",
      price: "$38.00",
      cta: "Shop now",
      brand: { colors: [] },
    });
    expect(layout.textBoxes.some((b) => b.role === "price")).toBe(true);
  });

  it("picks a brand colour with contrast >= 4.5 against the sampled background", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    // Solid white background — "#000000" clears 4.5:1 (21:1), a near-white
    // brand colour does not.
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const { layout } = await composeAd({
      background,
      placement,
      headline: "Shop the new collection",
      price: "$38.00",
      cta: "Shop now",
      brand: { colors: ["#eeeeee", "#000000"] },
    });
    const headlineBox = layout.textBoxes.find((b) => b.role === "headline");
    expect(headlineBox?.fg).toBe("#000000");
  });

  it("falls back to black or white when no brand colour clears 4.5:1", async () => {
    const placement = PLACEMENTS.meta_feed_1x1;
    const background = await solidBackground(placement.width, placement.height, [255, 255, 255]);
    const { layout } = await composeAd({
      background,
      placement,
      headline: "Shop the new collection",
      price: "$38.00",
      cta: "Shop now",
      // Both candidates are low-contrast against white.
      brand: { colors: ["#eeeeee", "#dddddd"] },
    });
    const headlineBox = layout.textBoxes.find((b) => b.role === "headline");
    expect(["#000000", "#ffffff"]).toContain(headlineBox?.fg);
  });
});
