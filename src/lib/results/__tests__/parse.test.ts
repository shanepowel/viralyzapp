import { describe, expect, it } from "vitest";
import { extractTag, matchRowsByTag, parseExport } from "@/lib/results/parse";

describe("parseExport", () => {
  it("parses a BOM-prefixed CSV", () => {
    const csv = "﻿Ad Name,Impressions,Clicks,Amount Spent (USD)\nvz_abcd,100,10,5.00\n";
    const { rows, rejected } = parseExport(csv, "meta");
    expect(rejected).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].adName).toBe("vz_abcd");
    expect(rows[0].impressions).toBe(100);
  });

  it("parses both comma-decimal and period-decimal numbers", () => {
    const csv = 'Ad Name,Impressions,Clicks,Amount Spent (USD)\nvz_abcd,"1,5%",10,1.5\n';
    const { rows } = parseExport(csv, "meta");
    expect(rows[0].impressions).toBe(1.5);
    expect(rows[0].spend).toBe(1.5);
  });

  it("sums rows sharing the same tag instead of double-counting them", () => {
    const csv = [
      "Ad Name,Impressions,Clicks,Amount Spent (USD)",
      "Spring vz_k3f9 — Placement A,100,10,5.00",
      "Spring vz_k3f9 — Placement B,200,20,8.00",
    ].join("\n");
    const { rows } = parseExport(csv, "meta");
    expect(rows).toHaveLength(1);
    expect(rows[0].impressions).toBe(300);
    expect(rows[0].clicks).toBe(30);
    expect(rows[0].spend).toBe(13);
  });

  it("rejects a row missing a required numeric field, with a reason", () => {
    const csv = ["Ad Name,Impressions,Clicks,Amount Spent (USD)", "vz_abcd,,10,5.00"].join("\n");
    const { rows, rejected } = parseExport(csv, "meta");
    expect(rows).toHaveLength(0);
    expect(rejected).toEqual([{ line: 2, reason: "Missing or unparsable impressions, clicks, or spend" }]);
  });

  it("handles quoted fields containing commas", () => {
    const csv = 'Ad Name,Impressions,Clicks,Amount Spent (USD)\n"Spring, vz_abcd",100,10,5.00\n';
    const { rows } = parseExport(csv, "meta");
    expect(rows[0].adName).toBe("Spring, vz_abcd");
  });
});

describe("extractTag", () => {
  it('extracts and lowercases a tag from "Spring VZ_K3F9 v2"', () => {
    expect(extractTag("Spring VZ_K3F9 v2")).toBe("vz_k3f9");
  });

  it("returns null when there is no tag", () => {
    expect(extractTag("Spring Collection Ad")).toBeNull();
  });
});

describe("matchRowsByTag", () => {
  it("returns a row with no tag as unmatched, with a reason", () => {
    const rows = [
      { adName: "Untagged ad", impressions: 100, clicks: 10, spend: 5, purchases: null, revenue: null },
    ];
    const { matched, unmatched } = matchRowsByTag(rows, new Map());
    expect(matched).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].reason).toContain("No vz_ tag");
  });

  it("matches a tagged row to its creative id", () => {
    const rows = [
      { adName: "vz_abcd", impressions: 100, clicks: 10, spend: 5, purchases: null, revenue: null },
    ];
    const { matched, unmatched } = matchRowsByTag(rows, new Map([["vz_abcd", "creative-1"]]));
    expect(unmatched).toHaveLength(0);
    expect(matched).toEqual([{ ...rows[0], creativeId: "creative-1" }]);
  });

  it("returns a tagged row with no matching creative as unmatched", () => {
    const rows = [
      { adName: "vz_zzzz", impressions: 100, clicks: 10, spend: 5, purchases: null, revenue: null },
    ];
    const { matched, unmatched } = matchRowsByTag(rows, new Map([["vz_abcd", "creative-1"]]));
    expect(matched).toHaveLength(0);
    expect(unmatched[0].reason).toContain("vz_zzzz");
  });
});
