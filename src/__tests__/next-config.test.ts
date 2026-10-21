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
];

describe("removed-route redirects", () => {
  it("permanently redirects every removed route (and its subpaths) to /discover", async () => {
    const redirects = await nextConfig.redirects!();
    for (const route of REMOVED_ROUTES) {
      const entry = redirects.find((r) => r.source === `/${route}/:path*`);
      expect(entry, `missing redirect for /${route}`).toBeDefined();
      expect(entry!.destination).toBe("/discover");
      expect(entry!.permanent).toBe(true);
    }
  });
});
