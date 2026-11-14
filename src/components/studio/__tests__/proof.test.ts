import { describe, expect, it } from "vitest";
import { readProof, type CreativeDTO, type FactorResultDTO, type LayoutDTO } from "@/components/studio/proof";

const layout: LayoutDTO = {
  width: 1080,
  height: 1920,
  textBoxes: [
    { role: "headline", x: 100, y: 250, w: 800, h: 120, overflowed: false, text: "Cures redness in a week" },
    { role: "cta", x: 100, y: 1500, w: 800, h: 80, overflowed: false, text: "Shop now" },
  ],
};

const f = (over: Partial<FactorResultDTO> & Pick<FactorResultDTO, "id">): FactorResultDTO => ({
  label: over.id,
  kind: "computed",
  status: "scored",
  passed: true,
  evidence: "",
  ...over,
});

function creative(factors: FactorResultDTO[], over: Partial<CreativeDTO> = {}): CreativeDTO {
  return {
    id: "c1",
    tag: "vz_ab12",
    angle: "offer",
    placement: "story_9x16",
    productId: "p1",
    status: "ready",
    headline: "Cures redness in a week",
    compositeUrl: "/x.png",
    aiGenerated: true,
    checks: [{ headline: 80, headlineBasis: { counted: 5, total: 6 }, factors, layout }],
    ...over,
  };
}

describe("readProof", () => {
  it("is cleared when every measured check passed, and ignores the AI estimate", () => {
    const proof = readProof(
      creative([f({ id: "contrast" }), f({ id: "hook_clarity", kind: "model", passed: false, value: 20 })]),
    );
    expect(proof.verdict).toBe("cleared");
    expect(proof.marks).toHaveLength(0);
    expect(proof.estimates).toHaveLength(1);
  });

  it("blocks on a failed policy rule, lists it first and points at the text that contains the phrase", () => {
    const proof = readProof(
      creative([
        f({ id: "char_limits", passed: false, evidence: "Headline is 52 characters (limit 40)" }),
        f({ id: "health_claim", kind: "rule", passed: false, evidence: '"cures redness" : no health claims' }),
      ]),
    );
    expect(proof.verdict).toBe("blocked");
    expect(proof.marks.map((m) => m.factor.id)).toEqual(["health_claim", "char_limits"]);
    expect(proof.marks[0]).toMatchObject({ n: 1, blocking: true, wording: true });
    expect(proof.marks[0].box?.role).toBe("headline");
    expect(proof.marks[1].box?.role).toBe("headline");
    expect(proof.marks[1].rule).toEqual({ no: 4, name: "Characters" });
  });

  it("places contrast and overflow marks on the box named in the evidence", () => {
    const proof = readProof(
      creative([
        f({ id: "contrast", passed: false, evidence: "cta contrast is 2.10:1 (needs 4.5:1)" }),
        f({ id: "safe_zone", passed: false, evidence: "headline overflowed its text box" }),
      ]),
    );
    expect(proof.verdict).toBe("fix");
    const [contrast, overflow] = proof.marks;
    expect(contrast.box?.role).toBe("cta");
    expect(contrast.wording).toBe(false);
    expect(overflow.box?.role).toBe("headline");
    expect(overflow.wording).toBe(true);
  });

  it("leaves a mark unplaced when the ad has no stored layout or the phrase is not on the image", () => {
    const base = creative([f({ id: "income_claim", kind: "rule", passed: false, evidence: '"earn £500 a day" : no income claims' })]);
    expect(readProof(base).marks[0].box).toBeNull();
    const noLayout = { ...base, checks: [{ ...base.checks[0], layout: null }] };
    expect(readProof(noLayout).marks[0].box).toBeNull();
  });

  it("reports work in progress and failure before anything else", () => {
    expect(readProof(creative([], { status: "generating" })).verdict).toBe("checking");
    expect(readProof(creative([], { status: "failed" })).verdict).toBe("failed");
    expect(readProof(creative([], { checks: [] })).verdict).toBe("unchecked");
  });
});
