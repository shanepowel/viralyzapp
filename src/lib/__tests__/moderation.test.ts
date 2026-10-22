import { describe, expect, it } from "vitest";
import { moderateImagePrompt } from "@/lib/moderation";

describe("moderateImagePrompt", () => {
  it("passes an ordinary product background prompt", () => {
    expect(
      moderateImagePrompt("A soft-lit marble countertop with a soy candle, warm morning light, no text."),
    ).toEqual({ ok: true });
  });

  it.each([
    ["A celebrity holding the candle", "real_person_likeness"],
    ["Model who looks like a famous actress", "real_person_likeness"],
    ["Portrait in the style of Taylor Swift", "real_person_likeness"],
    ["A nude figure beside the bottle", "sexual_content"],
    ["A gory scene behind the product", "violence"],
    ["Bottle on a shelf with the text SALE in neon", "rendered_text"],
  ])("blocks %s", (prompt, rule) => {
    const result = moderateImagePrompt(prompt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rule).toBe(rule);
  });

  it('does not treat "no text" as a request for text', () => {
    expect(moderateImagePrompt("Clean studio backdrop, no text, no words.").ok).toBe(true);
  });
});
