import { afterEach, describe, expect, it } from "vitest";
import { getImageProvider } from "@/lib/providers";

describe("getImageProvider", () => {
  const originalKey = process.env.FAL_KEY;

  afterEach(() => {
    process.env.FAL_KEY = originalKey;
  });

  it("returns null when unset", () => {
    delete process.env.FAL_KEY;
    expect(getImageProvider()).toBeNull();
  });

  it("returns a configured provider once FAL_KEY is set", () => {
    process.env.FAL_KEY = "test-key";
    const provider = getImageProvider();
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("fal");
  });
});
