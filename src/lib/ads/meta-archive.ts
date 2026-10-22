import { Prisma } from "@/generated/prisma/client";
import { hasAnthropic, metaAdLibraryToken } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { extractStructure, structureToStore } from "@/lib/structure";

export class NotConfigured extends Error {}

/** A single ad record as returned by Meta's Ad Library API (`ads_archive`). */
export type MetaArchiveAd = {
  id: string;
  page_name?: string | null;
  ad_delivery_start_time?: string | null;
  ad_delivery_stop_time?: string | null;
  // Meta's snapshot URL embeds the caller's access_token as a query param,
  // so it is never stored or shown — see mapArchiveAd.
  ad_snapshot_url?: string | null;
  ad_creative_bodies?: string[] | null;
  ad_creative_link_titles?: string[] | null;
  // Not a real ads_archive field — passed through when a caller has it from
  // a creative-group aggregation, so variantCount reflects an actual count
  // rather than a guess.
  creative_group_count?: number | null;
  country?: string | null;
};

export type ReferenceInput = {
  source: "meta_eu_uk";
  sourceRef: string;
  advertiser: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  daysRunning: number | null;
  variantCount: number | null;
  country: string | null;
  thumbnailUrl: null;
  structure: null;
  /** The ad's own copy, fed to structure extraction; not a Reference column. */
  creativeText: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * daysRunning is null whenever the start time is missing or unparsable —
 * never guessed. An ad with no stop time is still running, so it counts
 * through `now` rather than being treated as unknown.
 */
export function mapArchiveAd(raw: MetaArchiveAd, now: Date): ReferenceInput {
  const start = parseDate(raw.ad_delivery_start_time);
  const stop = parseDate(raw.ad_delivery_stop_time);
  const end = stop ?? now;

  const daysRunning = start ? Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) : null;

  return {
    source: "meta_eu_uk",
    sourceRef: raw.id,
    advertiser: raw.page_name ?? null,
    firstSeenAt: start,
    lastSeenAt: stop,
    daysRunning,
    variantCount: raw.creative_group_count ?? null,
    country: raw.country ?? null,
    // Never ad_snapshot_url: it carries our access_token, and it's an HTML
    // page rather than an image anyway. Discover links to the public Ad
    // Library page for the ad id instead.
    thumbnailUrl: null,
    // Populated by extraction at ingest (see ingestArchiveAds), never
    // guessed from the raw record here.
    structure: null,
    creativeText: creativeText(raw),
  };
}

function creativeText(raw: MetaArchiveAd): string | null {
  const parts = [...(raw.ad_creative_link_titles ?? []), ...(raw.ad_creative_bodies ?? [])]
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
}

type MetaArchivePageResponse = {
  data?: MetaArchiveAd[];
  paging?: { cursors?: { after?: string } };
};

export async function fetchArchivePage(params: {
  countries: string[];
  search: string;
  after?: string;
}): Promise<{ ads: MetaArchiveAd[]; next?: string }> {
  const token = metaAdLibraryToken();
  if (!token) {
    throw new NotConfigured("META_AD_LIBRARY_TOKEN is not set");
  }

  const url = new URL("https://graph.facebook.com/v21.0/ads_archive");
  url.searchParams.set("access_token", token);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_reached_countries", JSON.stringify(params.countries));
  url.searchParams.set("search_terms", params.search);
  url.searchParams.set(
    "fields",
    "id,page_name,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_titles",
  );
  if (params.after) url.searchParams.set("after", params.after);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Meta ad library request failed with status ${res.status}`);
  }
  const body = (await res.json()) as MetaArchivePageResponse;
  return { ads: body.data ?? [], next: body.paging?.cursors?.after };
}

/**
 * Upserts mapped ads into Reference, keyed on (source, sourceRef) in
 * application code rather than a DB constraint — see the note on
 * Reference.sourceRef in prisma/schema.prisma for why a single unique
 * constraint can't serve both this and the per-user dedup in
 * src/lib/references.ts. Always scoped to userId: null (Tier 1, shared).
 */
export type IngestDeps = {
  /** Overrides the real (Anthropic-backed) extractStructure — stub it in tests. */
  extract?: typeof extractStructure;
};

/**
 * Extracts structure from an ad's own copy. Returns null (leaving the row
 * eligible for a later pass) when there's no copy, no model, or nothing
 * was learned.
 */
async function structureFor(
  text: string | null,
  deps: IngestDeps,
): Promise<Prisma.InputJsonValue | null> {
  if (!text) return null;
  if (!deps.extract && !hasAnthropic()) return null;
  const result = await (deps.extract ?? extractStructure)({ text });
  return structureToStore(result) as Prisma.InputJsonValue | null;
}

export async function ingestArchiveAds(
  ads: ReferenceInput[],
  deps: IngestDeps = {},
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const { creativeText: text, ...ad } of ads) {
    const existing = await prisma.reference.findFirst({
      where: { userId: null, source: ad.source, sourceRef: ad.sourceRef },
    });

    // Only ever extract once per reference: a row that already has
    // structure keeps it rather than paying for the same call again.
    const structure = existing?.structure != null ? null : await structureFor(text, deps);

    if (existing) {
      await prisma.reference.update({
        where: { id: existing.id },
        data: {
          advertiser: ad.advertiser,
          firstSeenAt: ad.firstSeenAt,
          lastSeenAt: ad.lastSeenAt,
          daysRunning: ad.daysRunning,
          variantCount: ad.variantCount,
          country: ad.country,
          thumbnailUrl: ad.thumbnailUrl,
          ...(structure ? { structure } : {}),
          fetchedAt: new Date(),
        },
      });
      updated += 1;
    } else {
      await prisma.reference.create({
        // Prisma's Json field wants Prisma.JsonNull, not a literal null, to
        // mean "store SQL NULL" when nothing was extracted.
        data: { userId: null, ...ad, structure: structure ?? Prisma.JsonNull, fetchedAt: new Date() },
      });
      created += 1;
    }
  }

  return { created, updated };
}

/** Pages through every search term for the given countries and ingests each page. */
export async function runMetaIngest(opts: {
  countries: string[];
  searchTerms: string[];
  now?: Date;
}): Promise<{ created: number; updated: number }> {
  const now = opts.now ?? new Date();
  let created = 0;
  let updated = 0;

  for (const search of opts.searchTerms) {
    let after: string | undefined;
    do {
      const page = await fetchArchivePage({ countries: opts.countries, search, after });
      const mapped = page.ads.map((ad) => mapArchiveAd(ad, now));
      const result = await ingestArchiveAds(mapped);
      created += result.created;
      updated += result.updated;
      after = page.next;
    } while (after);
  }

  return { created, updated };
}
