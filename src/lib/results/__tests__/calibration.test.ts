import { describe, expect, it } from "vitest";
import { calibrate, spearman } from "@/lib/results/calibration";

describe("spearman", () => {
  it("is 1 for perfectly increasing series", () => {
    expect(spearman([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it("is -1 for perfectly decreasing series", () => {
    expect(spearman([1, 2, 3], [3, 2, 1])).toBe(-1);
  });

  it("is null for a constant series (zero variance)", () => {
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull();
  });

  it("is null for fewer than 3 points", () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
});

describe("calibrate", () => {
  function pair(score: number, impressions: number, clicks: number) {
    return { score, impressions, clicks };
  }

  it("is insufficient with 19 qualifying pairs", () => {
    const pairs = Array.from({ length: 19 }, (_, i) => pair(i, 1000, i));
    const result = calibrate(pairs);
    expect(result.status).toBe("insufficient");
    expect(result.rho).toBeNull();
    expect(result.n).toBe(19);
  });

  it("returns a rho with 20 qualifying pairs", () => {
    const pairs = Array.from({ length: 20 }, (_, i) => pair(i, 1000, i));
    const result = calibrate(pairs);
    expect(result.status).toBe("ok");
    expect(result.n).toBe(20);
    expect(result.rho).not.toBeNull();
  });

  it("excludes pairs below the impressions floor from N", () => {
    const pairs = [
      ...Array.from({ length: 20 }, (_, i) => pair(i, 1000, i)),
      pair(999, 500, 1),
    ];
    const result = calibrate(pairs);
    expect(result.n).toBe(20);
  });
});
