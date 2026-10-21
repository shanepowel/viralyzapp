import { describe, expect, it } from "vitest";
import { aggregate } from "@/lib/preflight/aggregate";
import type { FactorResult } from "@/lib/preflight/types";

function factor(overrides: Partial<FactorResult> = {}): FactorResult {
  return {
    id: "f",
    label: "Factor",
    kind: "computed",
    status: "scored",
    passed: true,
    evidence: "",
    ...overrides,
  };
}

describe("aggregate", () => {
  it("returns a null headline with only 3 scored factors", () => {
    const result = aggregate([factor(), factor(), factor()]);
    expect(result.headline).toBeNull();
    expect(result.counted).toBe(3);
  });

  it("averages 6 of 8 scored, 5 passed, to 83 with counted 6 and total 8", () => {
    const factors = [
      ...Array.from({ length: 5 }, () => factor({ passed: true })),
      factor({ passed: false }),
      factor({ status: "unavailable", passed: undefined }),
      factor({ status: "unavailable", passed: undefined }),
    ];
    const result = aggregate(factors);
    expect(result.headline).toBe(83);
    expect(result.counted).toBe(6);
    expect(result.total).toBe(8);
  });

  it("excludes a model factor from the headline", () => {
    const factors = [
      ...Array.from({ length: 4 }, () => factor({ passed: true })),
      factor({ kind: "model", status: "scored", passed: false }),
    ];
    const result = aggregate(factors);
    expect(result.headline).toBe(100);
    expect(result.counted).toBe(4);
    expect(result.total).toBe(4);
  });
});
