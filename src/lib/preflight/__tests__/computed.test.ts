import { describe, expect, it } from "vitest";
import {
  checkAspect,
  checkCharLimits,
  checkContrast,
  checkSafeZone,
  checkTextArea,
  contrastRatio,
} from "@/lib/preflight/computed";
import { PLACEMENTS } from "@/lib/preflight/placements";
import type { CompositeLayout, TextBox } from "@/lib/preflight/types";

const STORY = PLACEMENTS.story_9x16;
const FEED_SQUARE = PLACEMENTS.meta_feed_1x1;

function textBox(overrides: Partial<TextBox> = {}): TextBox {
  return {
    role: "headline",
    x: 100,
    y: 100,
    w: 400,
    h: 100,
    fg: "#000000",
    bg: "#ffffff",
    overflowed: false,
    text: "Shop the new collection",
    ...overrides,
  };
}

function layout(overrides: Partial<CompositeLayout> = {}): CompositeLayout {
  return {
    width: STORY.width,
    height: STORY.height,
    textBoxes: [textBox()],
    ...overrides,
  };
}

describe("contrastRatio", () => {
  it("black on white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });

  it("identical colours is 1", () => {
    expect(contrastRatio("#4b2e2e", "#4b2e2e")).toBe(1);
  });
});

describe("checkContrast", () => {
  it("fails below 4.5", () => {
    const result = checkContrast(layout({ textBoxes: [textBox({ fg: "#888888", bg: "#999999" })] }), STORY);
    expect(result.status).toBe("scored");
    expect(result.passed).toBe(false);
  });

  it("passes at or above 4.5", () => {
    const result = checkContrast(layout({ textBoxes: [textBox({ fg: "#000000", bg: "#ffffff" })] }), STORY);
    expect(result.passed).toBe(true);
  });

  it("is unavailable with no text boxes", () => {
    const result = checkContrast(layout({ textBoxes: [] }), STORY);
    expect(result.status).toBe("unavailable");
  });
});

describe("checkSafeZone", () => {
  it("fails when a box intersects the story bottom safe zone", () => {
    const bottomBox = textBox({ y: STORY.height - STORY.safeZone.bottom + 10, h: 50 });
    const result = checkSafeZone(layout({ textBoxes: [bottomBox] }), STORY);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain("bottom");
  });

  it("passes when every box is clear of the safe zone", () => {
    const clearBox = textBox({ y: STORY.height / 2, x: STORY.width / 2 - 50 });
    const result = checkSafeZone(layout({ textBoxes: [clearBox] }), STORY);
    expect(result.passed).toBe(true);
  });

  it("fails for a box marked overflowed, naming its role", () => {
    const overflowedBox = textBox({ role: "cta", overflowed: true, y: STORY.height / 2 });
    const result = checkSafeZone(layout({ textBoxes: [overflowedBox] }), STORY);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain("cta");
  });

  it("is unavailable with no text boxes", () => {
    const result = checkSafeZone(layout({ textBoxes: [] }), STORY);
    expect(result.status).toBe("unavailable");
  });
});

describe("checkAspect", () => {
  it("fails when width/height differs from the placement by more than 1%", () => {
    const result = checkAspect(layout({ width: 1080, height: 1000 }), FEED_SQUARE);
    expect(result.passed).toBe(false);
  });

  it("passes when the aspect ratio matches", () => {
    const result = checkAspect(layout({ width: 1080, height: 1080 }), FEED_SQUARE);
    expect(result.passed).toBe(true);
  });
});

describe("checkCharLimits", () => {
  it("fails at headlineMax + 1", () => {
    const tooLong = "x".repeat(STORY.headlineMax + 1);
    const result = checkCharLimits(layout({ textBoxes: [textBox({ text: tooLong })] }), STORY);
    expect(result.passed).toBe(false);
  });

  it("passes at exactly headlineMax", () => {
    const exact = "x".repeat(STORY.headlineMax);
    const result = checkCharLimits(layout({ textBoxes: [textBox({ text: exact })] }), STORY);
    expect(result.passed).toBe(true);
  });

  it("is unavailable with no text boxes", () => {
    const result = checkCharLimits(layout({ textBoxes: [] }), STORY);
    expect(result.status).toBe("unavailable");
  });

  it("fails when primary text is over primaryMax, even with a short headline", () => {
    const result = checkCharLimits(layout(), STORY, { primaryText: "x".repeat(STORY.primaryMax + 1) });
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain(`primary text is ${STORY.primaryMax + 1}`);
  });

  it("passes when primary text is exactly primaryMax", () => {
    const result = checkCharLimits(layout(), STORY, { primaryText: "x".repeat(STORY.primaryMax) });
    expect(result.passed).toBe(true);
  });
});

describe("checkTextArea", () => {
  it("is unavailable with no text boxes", () => {
    const result = checkTextArea(layout({ textBoxes: [] }), STORY);
    expect(result.status).toBe("unavailable");
  });

  it("scores the ratio of text area to canvas area", () => {
    const result = checkTextArea(
      layout({ width: 1000, height: 1000, textBoxes: [textBox({ w: 100, h: 100 })] }),
      STORY,
    );
    expect(result.status).toBe("scored");
    expect(result.value).toBeCloseTo(0.01);
  });
});
