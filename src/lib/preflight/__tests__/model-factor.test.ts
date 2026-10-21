import { describe, expect, it } from "vitest";
import { hasAnthropic } from "@/lib/env";
import { assessHook } from "@/lib/preflight/model-factor";

describe("assessHook", () => {
  it("is unavailable when Anthropic is unconfigured", async () => {
    expect(hasAnthropic()).toBe(false);
    const result = await assessHook({ headline: "Lose 10kg in 7 days" });
    expect(result.kind).toBe("model");
    expect(result.status).toBe("unavailable");
    expect(result.label).toContain("AI-assessed");
  });

  it("is unavailable for an empty headline even if a key were set", async () => {
    const result = await assessHook({ headline: "" });
    expect(result.status).toBe("unavailable");
  });
});
