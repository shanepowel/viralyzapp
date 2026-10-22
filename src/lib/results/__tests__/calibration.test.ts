import { describe, expect, it } from "vitest";
import { calibrate, latestRowPerCreative, spearman } from "@/lib/results/calibration";

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

describe("latestRowPerCreative", () => {
  const older = new Date("2026-10-01T00:00:00Z");
  const newer = new Date("2026-10-15T00:00:00Z");

  it("keeps one row per creative, from the newest import", () => {
    const rows = [
      { creativeId: "a", importedAt: older, impressions: 1000 },
      { creativeId: "a", importedAt: newer, impressions: 2500 },
      { creativeId: "b", importedAt: older, impressions: 1200 },
    ];
    const result = latestRowPerCreative(rows);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.creativeId === "a")?.impressions).toBe(2500);
  });

  it("drops rows with no creative", () => {
    expect(latestRowPerCreative([{ creativeId: null, importedAt: newer }])).toEqual([]);
  });

  it("stops a re-import of the same 10 ads from reaching the 20-ad floor", () => {
    const rows = [older, newer].flatMap((importedAt) =>
      Array.from({ length: 10 }, (_, i) => ({ creativeId: `c${i}`, importedAt, score: i, impressions: 1000, clicks: i })),
    );
    expect(calibrate(rows).status).toBe("ok");
    expect(calibrate(latestRowPerCreative(rows))).toEqual({ n: 10, rho: null, status: "insufficient" });
  });
});
