import type { ImageProvider } from "@/lib/providers/types";

// A minimal, valid 1x1 PNG — real decodable bytes for tests and local dev
// that don't want a real network call, not meant to look like anything.
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/** In-memory test double: controllable failures and latency, no network. */
export class FakeProvider implements ImageProvider {
  name = "fake";
  model = "fake-v1";
  costPerImage = 0;
  delayMs = 0;

  private failuresRemaining = 0;

  /** The next `n` calls to generate() reject; calls after that succeed. */
  failNext(n: number): void {
    this.failuresRemaining = n;
  }

  async generate(
    // No fields are read — destructuring with nothing bound avoids an
    // unused-parameter warning while still typing the call signature.
    {}: { prompt: string; productImageUrl: string; aspect: "1:1" | "4:5" | "9:16" },
  ): Promise<Buffer> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("FakeProvider: simulated failure");
    }
    return PLACEHOLDER_PNG;
  }
}
