import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  serverExternalPackages: ["bullmq", "ioredis", "@aws-sdk/client-s3", "pg"],
  async redirects() {
    return REMOVED_ROUTES.map((route) => ({
      source: `/${route}/:path*`,
      destination: "/discover",
      permanent: true,
    }));
  },
};

export default nextConfig;
