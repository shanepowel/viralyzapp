import { describe, expect, it } from "vitest";
import { checkPolicy } from "@/lib/preflight/rules";

describe("checkPolicy", () => {
  it('flags "lose 10kg in 7 days" as a health claim', () => {
    const results = checkPolicy({
      headline: "Lose 10kg in 7 days",
      primaryText: "Our new program really works.",
      cta: "Shop now",
    });
    const healthClaim = results.find((r) => r.id === "health_claim");
    expect(healthClaim?.passed).toBe(false);
    expect(healthClaim?.evidence).toContain("Lose 10kg in 7 days");
  });

  it("passes neutral copy", () => {
    const results = checkPolicy({
      headline: "Hand-poured soy candles, made in small batches",
      primaryText: "Warm, long-lasting scents for cozy nights in.",
      cta: "Shop the collection",
    });
    expect(results.every((r) => r.passed === true)).toBe(true);
  });

  it("returns one rule FactorResult per policy category", () => {
    const results = checkPolicy({ headline: "", primaryText: "", cta: "" });
    expect(results.length).toBe(4);
    expect(results.every((r) => r.kind === "rule" && r.status === "scored")).toBe(true);
  });
});
