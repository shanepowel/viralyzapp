import { getRedirectUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const REMOVED_ROUTES = [
  "engage",
  "competitors",
  "media-kit",
  "calendar",
  "analytics",
  "hook-lab",
  "captions",
  "script-doctor",
  "thumbnails",
  "trends",
  "library",
  "score",
  "content",
  "kit",
  // Linked from the marketing site's old feature pages.
  "analyze",
  "caption-studio",
];

async function responseFor(path: string) {
  return unstable_getResponseFromNextConfig({ url: `https://app.viralyz.com${path}`, nextConfig });
}

describe("removed-route redirects", () => {
  it.each(REMOVED_ROUTES)("/%s returns 308 to /discover", async (route) => {
    const response = await responseFor(`/${route}`);
    expect(response.status).toBe(308);
    expect(getRedirectUrl(response)).toBe("https://app.viralyz.com/discover");
  });

  it("redirects subpaths of a removed route too", async () => {
    const response = await responseFor("/score/abc123");
    expect(response.status).toBe(308);
    expect(getRedirectUrl(response)).toBe("https://app.viralyz.com/discover");
  });

  it("leaves the new routes alone", async () => {
    for (const path of ["/discover", "/brand", "/studio", "/creatives", "/results", "/account"]) {
      const response = await responseFor(path);
      expect(getRedirectUrl(response)).toBeNull();
    }
  });
});
