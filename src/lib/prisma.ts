import { mkdirSync } from "fs";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Resolve SQLite file: URLs to an absolute path under the project root. */
export function resolveSqliteUrl(raw?: string): string {
  const fallback = "file:./prisma/dev.db";
  const url = raw && raw.trim().length > 0 ? raw.trim() : fallback;

  if (!url.startsWith("file:")) {
    return url;
  }

  const filePath = url.replace(/^file:/, "");
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  mkdirSync(path.dirname(absolute), { recursive: true });
  return `file:${absolute}`;
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: resolveSqliteUrl(process.env.DATABASE_URL),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
