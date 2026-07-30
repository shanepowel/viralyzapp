import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is required (Postgres connection string).");
  }
  if (raw.startsWith("file:")) {
    throw new Error(
      "SQLite file: URLs are no longer supported. Set DATABASE_URL to a Postgres URL (Neon/local).",
    );
  }

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: raw,
      max: isServerless() ? 1 : 10,
      ssl:
        raw.includes("sslmode=require") || raw.includes("neon.tech")
          ? { rejectUnauthorized: false }
          : undefined,
    });
  globalForPrisma.pgPool = pool;
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy proxy so Next.js build page-collection does not open DB at import time. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
