import type { Prisma, Reference } from "@/generated/prisma/client";
import { extractBrand } from "@/lib/brand-import";
import { hasAnthropic } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { safeFetch } from "@/lib/safe-fetch";
import type { StoredObject } from "@/lib/storage";
import { extractStructure, structureToStore } from "@/lib/structure";

export type SaveReferenceDeps = {
  /** Overrides the real (Anthropic-backed) extractStructure — stub it in tests. */
  extract?: typeof extractStructure;
  /** Overrides safeFetch for reading a pasted page — stub it in tests. */
  fetchPage?: (url: string) => Promise<{ body: string }>;
};

type ExtractionInput = Parameters<typeof extractStructure>[0];

/**
 * What the model gets to look at for a user reference: the uploaded image
 * itself, or a pasted page's title and lead image (fetched SSRF-safely).
 */
async function extractionInput(
  input: { url?: string; image?: { data: Buffer; mediaType: string } },
  deps: SaveReferenceDeps,
): Promise<ExtractionInput | null> {
  if (input.image) return { image: input.image };
  if (!input.url) return null;
  const page = await (deps.fetchPage ?? safeFetch)(input.url);
  const draft = extractBrand(page.body, input.url);
  if (!draft.title && draft.imageUrls.length === 0) return null;
  return { text: draft.title ?? undefined, imageUrl: draft.imageUrls[0] };
}

/**
 * Saves (or returns the existing row for) a user's own pasted URL or
 * uploaded file as a Tier 2 reference. Idempotent per user: saving the
 * same URL twice returns the same row rather than creating a duplicate.
 *
 * Structure extraction runs whenever the row has none yet. It never blocks
 * the save: an unreachable page, a missing API key, or a model that learns
 * nothing leaves structure null rather than failing the request.
 */
export async function saveUserReference(
  userId: string,
  input: { url?: string; file?: StoredObject; image?: { data: Buffer; mediaType: string } },
  deps: SaveReferenceDeps = {},
): Promise<Reference> {
  if (!input.url && !input.file) {
    throw new Error("saveUserReference requires a url or a file");
  }
  const source = input.url ? "user_url" : "user_upload";
  const sourceRef = input.url ?? input.file!.storageKey;

  const existing = await prisma.reference.findFirst({ where: { userId, source, sourceRef } });
  const row =
    existing ??
    (await prisma.reference.create({
      data: {
        userId,
        source,
        sourceRef,
        thumbnailUrl: input.file?.mediaUrl,
      },
    }));

  if (row.structure != null || (!deps.extract && !hasAnthropic())) return row;

  try {
    const extractionSource = await extractionInput(input, deps);
    if (!extractionSource) return row;
    const structure = structureToStore(await (deps.extract ?? extractStructure)(extractionSource));
    if (!structure) return row;
    return prisma.reference.update({
      where: { id: row.id },
      data: { structure: structure as Prisma.InputJsonValue },
    });
  } catch {
    return row;
  }
}

/** A user's own (Tier 2) references, newest first. */
export async function listUserReferences(userId: string): Promise<Reference[]> {
  return prisma.reference.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * One reference, if this user may see it: any shared (Tier 1) reference,
 * or one of their own. Someone else's Tier 2 reference reads as not found.
 */
export async function getReferenceForUser(id: string, userId: string): Promise<Reference | null> {
  return prisma.reference.findFirst({
    where: { id, OR: [{ userId: null }, { userId }] },
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
