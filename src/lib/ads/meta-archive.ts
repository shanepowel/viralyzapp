import { Prisma } from "@/generated/prisma/client";
import { metaAdLibraryToken } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export class NotConfigured extends Error {}

/** A single ad record as returned by Meta's Ad Library API (`ads_archive`). */
export type MetaArchiveAd = {
  id: string;
  page_name?: string | null;
  ad_delivery_start_time?: string | null;
  ad_delivery_stop_time?: string | null;
  ad_snapshot_url?: string | null;
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
  thumbnailUrl: string | null;
  structure: null;
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
    thumbnailUrl: raw.ad_snapshot_url ?? null,
    // Populated by a separate extraction pass (src/lib/structure.ts), never
    // guessed here at ingest time.
    structure: null,
  };
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
    "id,page_name,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url",
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
export async function ingestArchiveAds(
  ads: ReferenceInput[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const ad of ads) {
    const existing = await prisma.reference.findFirst({
      where: { userId: null, source: ad.source, sourceRef: ad.sourceRef },
    });

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
          fetchedAt: new Date(),
        },
      });
      updated += 1;
    } else {
      await prisma.reference.create({
        // structure is always null at ingest time (a separate extraction
        // pass populates it) — Prisma's Json field wants Prisma.JsonNull,
        // not a literal null, to mean "store SQL NULL".
        data: { userId: null, ...ad, structure: Prisma.JsonNull, fetchedAt: new Date() },
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
