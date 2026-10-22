import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const NOW = new Date("2026-10-21T00:00:00Z");

// Recorded (trimmed) shapes from Meta's ads_archive API.
const AD_WITH_STOP_TIME = {
  id: "ad-with-stop",
  page_name: "Hearth & Wick",
  ad_delivery_start_time: "2026-08-01T00:00:00Z",
  ad_delivery_stop_time: "2026-08-31T00:00:00Z",
  ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=ad-with-stop&access_token=test-token",
  ad_creative_link_titles: ["Hand-poured soy candles"],
  ad_creative_bodies: ["20% off your first order. Shop now."],
};

const AD_STILL_RUNNING = {
  id: "ad-still-running",
  page_name: "Kiln & Bean",
  ad_delivery_start_time: "2026-09-21T00:00:00Z",
  ad_delivery_stop_time: null,
  ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=ad-still-running",
};

const AD_NO_START_TIME = {
  id: "ad-no-start",
  page_name: "Nomad Thread",
  ad_delivery_start_time: null,
  ad_delivery_stop_time: null,
  ad_snapshot_url: null,
};

describe("mapArchiveAd", () => {
  it("daysRunning is null when start time is absent", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    const mapped = mapArchiveAd(AD_NO_START_TIME, NOW);
    expect(mapped.daysRunning).toBeNull();
    expect(mapped.firstSeenAt).toBeNull();
  });

  it("an ad with no stop time counts to now", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    const mapped = mapArchiveAd(AD_STILL_RUNNING, NOW);
    // 2026-09-21 -> 2026-10-21 is exactly 30 days.
    expect(mapped.daysRunning).toBe(30);
    expect(mapped.lastSeenAt).toBeNull();
  });

  it("computes daysRunning between start and stop when both are present", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    const mapped = mapArchiveAd(AD_WITH_STOP_TIME, NOW);
    expect(mapped.daysRunning).toBe(30);
  });

  it("stores structure null until extraction runs", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    const mapped = mapArchiveAd(AD_WITH_STOP_TIME, NOW);
    expect(mapped.structure).toBeNull();
  });

  it("carries the advertiser through as-is", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    const mapped = mapArchiveAd(AD_WITH_STOP_TIME, NOW);
    expect(mapped.advertiser).toBe("Hearth & Wick");
    expect(mapped.source).toBe("meta_eu_uk");
    expect(mapped.sourceRef).toBe("ad-with-stop");
  });

  it("never stores the snapshot URL, which carries the access token", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    const mapped = mapArchiveAd(AD_WITH_STOP_TIME, NOW);
    expect(mapped.thumbnailUrl).toBeNull();
    expect(JSON.stringify(mapped)).not.toContain("access_token");
  });

  it("collects the ad's own copy for structure extraction", async () => {
    const { mapArchiveAd } = await import("@/lib/ads/meta-archive");
    expect(mapArchiveAd(AD_WITH_STOP_TIME, NOW).creativeText).toBe(
      "Hand-poured soy candles\n20% off your first order. Shop now.",
    );
    expect(mapArchiveAd(AD_NO_START_TIME, NOW).creativeText).toBeNull();
  });
});

describe("fetchArchivePage", () => {
  const originalToken = process.env.META_AD_LIBRARY_TOKEN;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    process.env.META_AD_LIBRARY_TOKEN = originalToken;
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it("throws NotConfigured when the token is missing", async () => {
    delete process.env.META_AD_LIBRARY_TOKEN;
    vi.resetModules();
    const { fetchArchivePage, NotConfigured } = await import("@/lib/ads/meta-archive");
    await expect(fetchArchivePage({ countries: ["GB"], search: "candle" })).rejects.toThrow(
      NotConfigured,
    );
  });

  it("returns ads and the next cursor from a configured call", async () => {
    process.env.META_AD_LIBRARY_TOKEN = "test-token";
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [AD_WITH_STOP_TIME], paging: { cursors: { after: "cursor-2" } } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchArchivePage } = await import("@/lib/ads/meta-archive");
    const result = await fetchArchivePage({ countries: ["GB"], search: "candle" });
    expect(result.ads).toEqual([AD_WITH_STOP_TIME]);
    expect(result.next).toBe("cursor-2");
  });
});

describe("ingestArchiveAds", () => {
  afterEach(async () => {
    await prisma.reference.deleteMany({ where: { source: "meta_eu_uk", userId: null } });
  });

  it("is idempotent on (source, sourceRef) — re-ingesting a page updates rather than duplicates", async () => {
    const { mapArchiveAd, ingestArchiveAds } = await import("@/lib/ads/meta-archive");
    const sourceRef = `ingest-${randomUUID()}`;
    const ad = { ...AD_WITH_STOP_TIME, id: sourceRef };

    const first = await ingestArchiveAds([mapArchiveAd(ad, NOW)]);
    expect(first).toEqual({ created: 1, updated: 0 });

    const updatedAd = { ...ad, ad_delivery_stop_time: "2026-09-15T00:00:00Z" };
    const second = await ingestArchiveAds([mapArchiveAd(updatedAd, NOW)]);
    expect(second).toEqual({ created: 0, updated: 1 });

    const rows = await prisma.reference.findMany({
      where: { source: "meta_eu_uk", sourceRef, userId: null },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastSeenAt?.toISOString()).toBe(new Date("2026-09-15T00:00:00Z").toISOString());
  });

  it("extracts structure from the ad copy once, and keeps it on re-ingest", async () => {
    const { mapArchiveAd, ingestArchiveAds } = await import("@/lib/ads/meta-archive");
    const sourceRef = `extract-${randomUUID()}`;
    const ad = { ...AD_WITH_STOP_TIME, id: sourceRef };
    const extract = vi.fn().mockResolvedValue({
      hookType: "discount",
      layout: null,
      offerType: "discount",
      cta: "shop-now",
      model: "test-model",
    });

    await ingestArchiveAds([mapArchiveAd(ad, NOW)], { extract });
    await ingestArchiveAds([mapArchiveAd(ad, NOW)], { extract });

    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledWith({ text: "Hand-poured soy candles\n20% off your first order. Shop now." });
    const row = await prisma.reference.findFirstOrThrow({ where: { sourceRef, userId: null } });
    expect(row.structure).toMatchObject({ hookType: "discount", cta: "shop-now", model: "test-model" });
  });

  it("leaves structure null when extraction learns nothing, so a later pass can retry", async () => {
    const { mapArchiveAd, ingestArchiveAds } = await import("@/lib/ads/meta-archive");
    const sourceRef = `extract-null-${randomUUID()}`;
    const extract = vi.fn().mockResolvedValue({
      hookType: null,
      layout: null,
      offerType: null,
      cta: null,
      model: "test-model",
    });

    await ingestArchiveAds([mapArchiveAd({ ...AD_WITH_STOP_TIME, id: sourceRef }, NOW)], { extract });
    const row = await prisma.reference.findFirstOrThrow({ where: { sourceRef, userId: null } });
    expect(row.structure).toBeNull();
  });
});

describe("runMetaIngest", () => {
  const originalToken = process.env.META_AD_LIBRARY_TOKEN;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.META_AD_LIBRARY_TOKEN = "test-token";
  });

  afterEach(async () => {
    process.env.META_AD_LIBRARY_TOKEN = originalToken;
    globalThis.fetch = originalFetch;
    vi.resetModules();
    await prisma.reference.deleteMany({ where: { source: "meta_eu_uk", userId: null } });
  });

  it("follows pagination cursors across pages for a search term", async () => {
    vi.resetModules();
    const adA = { ...AD_WITH_STOP_TIME, id: `page-a-${randomUUID()}` };
    const adB = { ...AD_STILL_RUNNING, id: `page-b-${randomUUID()}` };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [adA], paging: { cursors: { after: "page-2" } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [adB], paging: {} }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { runMetaIngest } = await import("@/lib/ads/meta-archive");
    const result = await runMetaIngest({ countries: ["GB"], searchTerms: ["candle"], now: NOW });
    expect(result).toEqual({ created: 2, updated: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
