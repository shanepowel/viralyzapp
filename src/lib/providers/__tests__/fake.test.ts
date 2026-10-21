import { describe, expect, it } from "vitest";
import { FakeProvider } from "@/lib/providers/fake";

describe("FakeProvider", () => {
  it("failNext(1) rejects once then succeeds", async () => {
    const provider = new FakeProvider();
    provider.failNext(1);

    await expect(
      provider.generate({ prompt: "x", productImageUrl: "https://example.com/x.jpg", aspect: "1:1" }),
    ).rejects.toThrow();

    const result = await provider.generate({
      prompt: "x",
      productImageUrl: "https://example.com/x.jpg",
      aspect: "1:1",
    });
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("succeeds immediately when failNext was never called", async () => {
    const provider = new FakeProvider();
    const result = await provider.generate({
      prompt: "x",
      productImageUrl: "https://example.com/x.jpg",
      aspect: "9:16",
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
