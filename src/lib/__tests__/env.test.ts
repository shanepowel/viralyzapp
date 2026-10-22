import { afterEach, describe, expect, it } from "vitest";
import { creditPricePerVariant } from "@/lib/env";

describe("creditPricePerVariant", () => {
  const original = process.env.CREDIT_PRICE_PER_VARIANT;
  afterEach(() => {
    if (original === undefined) delete process.env.CREDIT_PRICE_PER_VARIANT;
    else process.env.CREDIT_PRICE_PER_VARIANT = original;
  });

  it("defaults to 1 when unset", () => {
    delete process.env.CREDIT_PRICE_PER_VARIANT;
    expect(creditPricePerVariant()).toBe(1);
  });

  it("reads a positive integer", () => {
    process.env.CREDIT_PRICE_PER_VARIANT = "4";
    expect(creditPricePerVariant()).toBe(4);
  });

  it.each(["0", "-2", "1.5", "abc"])("throws on %s instead of charging it", (value) => {
    process.env.CREDIT_PRICE_PER_VARIANT = value;
    expect(() => creditPricePerVariant()).toThrow();
  });
});
