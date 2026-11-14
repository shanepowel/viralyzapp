import { describe, expect, it, vi } from "vitest";

// isWordingMark is pure; keep the database and native modules out of the import graph.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/generation", () => ({ CHECK_VERSION: 1, formatPrice: () => "" }));
vi.mock("@/lib/storage", () => ({ readStoredObject: vi.fn(), storeUpload: vi.fn() }));

import { isWordingMark } from "@/lib/fix";
import type { FactorResult } from "@/lib/preflight/types";

const f = (over: Partial<FactorResult>): FactorResult => ({
  id: "contrast",
  label: "x",
  kind: "computed",
  status: "scored",
  passed: false,
  evidence: "",
  ...over,
});

describe("isWordingMark", () => {
  it("treats failed policy rules, character limits and overflowed text as wording problems", () => {
    expect(isWordingMark(f({ id: "health_claim", kind: "rule" }))).toBe(true);
    expect(isWordingMark(f({ id: "char_limits" }))).toBe(true);
    expect(isWordingMark(f({ id: "safe_zone", evidence: "headline overflowed its text box" }))).toBe(true);
  });

  it("does not offer a rewrite for layout problems, passes, estimates or unscored checks", () => {
    expect(isWordingMark(f({ id: "safe_zone", evidence: "cta intersects the bottom safe zone" }))).toBe(false);
    expect(isWordingMark(f({ id: "contrast" }))).toBe(false);
    expect(isWordingMark(f({ id: "char_limits", passed: true }))).toBe(false);
    expect(isWordingMark(f({ id: "char_limits", status: "unavailable", passed: undefined }))).toBe(false);
  });
});
