import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  viralyzDbReady: boolean | undefined;
};

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Resolve SQLite file: URLs. On Vercel, use /tmp (read-only project FS). */
export function resolveSqliteUrl(raw?: string): string {
  const fallback = "file:./prisma/dev.db";
  const url = raw && raw.trim().length > 0 ? raw.trim() : fallback;

  if (!url.startsWith("file:")) {
    return url;
  }

  const filePath = url.replace(/^file:/, "");
  let absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (isServerless()) {
    const dir = "/tmp/viralyz";
    mkdirSync(dir, { recursive: true });
    absolute = path.join(dir, path.basename(absolute) || "dev.db");
    ensureDemoDatabase(absolute);
  } else {
    mkdirSync(path.dirname(absolute), { recursive: true });
  }

  return `file:${absolute}`;
}

/** Copy the shipped seeded DB into /tmp when missing (Vercel cold start). */
function ensureDemoDatabase(targetPath: string) {
  if (existsSync(targetPath)) return;

  const root = /* turbopackIgnore: true */ process.cwd();
  const candidates = [
    path.join(root, "prisma", "demo.db"),
    path.join(root, "prisma", "dev.db"),
  ];

  for (const src of candidates) {
    if (existsSync(src)) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(src, targetPath);
      return;
    }
  }
}

function createPrismaClient() {
  const resolved = resolveSqliteUrl(process.env.DATABASE_URL);
  if (!resolved.startsWith("file:")) {
    throw new Error(
      "This build uses SQLite. Set DATABASE_URL to a file: URL, or configure a Postgres adapter.",
    );
  }

  const adapter = new PrismaBetterSqlite3({ url: resolved });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse across hot reloads and Vercel warm instances
globalForPrisma.prisma = prisma;
