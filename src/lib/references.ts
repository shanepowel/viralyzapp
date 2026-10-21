import type { Reference } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { StoredObject } from "@/lib/storage";

/**
 * Saves (or returns the existing row for) a user's own pasted URL or
 * uploaded file as a Tier 2 reference. Idempotent per user: saving the
 * same URL twice returns the same row rather than creating a duplicate.
 */
export async function saveUserReference(
  userId: string,
  input: { url?: string; file?: StoredObject },
): Promise<Reference> {
  if (!input.url && !input.file) {
    throw new Error("saveUserReference requires a url or a file");
  }
  const source = input.url ? "user_url" : "user_upload";
  const sourceRef = input.url ?? input.file!.storageKey;

  const existing = await prisma.reference.findFirst({ where: { userId, source, sourceRef } });
  if (existing) return existing;

  return prisma.reference.create({
    data: {
      userId,
      source,
      sourceRef,
      thumbnailUrl: input.file?.mediaUrl,
    },
  });
}

export type ListReferencesFilter = {
  category?: string;
  source?: string;
  minDaysRunning?: number;
  cursor?: string;
};

const PAGE_SIZE = 24;

/**
 * Lists shared (Tier 1, official) references for Discover. Tier 2 rows — a
 * user's own pasted URL or upload — always carry a userId and are
 * deliberately excluded here regardless of the `source` filter, since this
 * function takes no userId and has no way to scope them to their owner;
 * surfacing someone else's private reference through a public listing
 * would be a privacy leak.
 */
export async function listReferences(
  filter: ListReferencesFilter,
): Promise<{ items: Reference[]; next?: string }> {
  const rows = await prisma.reference.findMany({
    where: {
      userId: null,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.source ? { source: filter.source } : {}),
      // A null daysRunning never satisfies >=, so this excludes those rows
      // rather than treating "unknown" as passing the filter.
      ...(filter.minDaysRunning != null ? { daysRunning: { gte: filter.minDaysRunning } } : {}),
    },
    orderBy: { id: "desc" },
    take: PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { items, next: hasMore ? items[items.length - 1].id : undefined };
}
