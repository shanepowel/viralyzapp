import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bullmq", "ioredis", "@aws-sdk/client-s3", "better-sqlite3"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/demo.db", "./prisma/migrations/**"],
  },
};

export default nextConfig;
