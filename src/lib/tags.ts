import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSuffix(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * vz_<4 lowercase base36 chars>, retried on collision against Creative.tag.
 *
 * This check is advisory, not a reservation: two concurrent callers can both
 * pass it for the same candidate before either inserts. Don't create a
 * Creative directly off this — use withUniqueTag, which retries the actual
 * insert on a real conflict instead of just lowering the odds of one.
 */
export async function newTag(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const tag = `vz_${randomSuffix()}`;
    const existing = await prisma.creative.findUnique({ where: { tag }, select: { id: true } });
    if (!existing) return tag;
  }
  throw new Error("Could not generate a unique tag after 10 attempts");
}

function conflictFields(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];
  // The classic shape (most connectors): meta.target is the field list.
  if (Array.isArray(meta.target)) return meta.target as string[];
  if (typeof meta.target === "string") return [meta.target];
  // The @prisma/adapter-pg driver-adapter shape: the field list is nested
  // under the underlying Postgres error instead.
  const nested = meta.driverAdapterError as
    | { cause?: { constraint?: { fields?: string[] } } }
    | undefined;
  return nested?.cause?.constraint?.fields ?? [];
}

function isTagConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    conflictFields(err.meta as Record<string, unknown> | undefined).includes("tag")
  );
}

/**
 * Runs `create` with a fresh tag, retrying with another tag if the insert
 * itself hits a real tag conflict (two requests racing on the same
 * candidate) rather than failing the request outright.
 */
export async function withUniqueTag<T>(create: (tag: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const tag = await newTag();
    try {
      return await create(tag);
    } catch (err) {
      if (!isTagConflict(err) || attempt === 4) throw err;
    }
  }
  throw new Error("Could not create a row with a unique tag after 5 attempts");
}
