"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { SAMPLE_REFERENCES } from "@/lib/samples";

type DiscoverReference = {
  id: string;
  source: string;
  sourceRef: string;
  advertiser: string | null;
  daysRunning: number | null;
  variantCount: number | null;
  thumbnailUrl: string | null;
  format: "image" | "video" | null;
  structure: { hookType: string | null; offerType: string | null; layout: string | null } | null;
};

const SOURCE_LABELS: Record<string, string> = {
  meta_eu_uk: "Meta EU/UK",
  tiktok_ccl: "TikTok CCL",
  vendor: "Vendor feed",
  user_url: "Yours, link",
  user_upload: "Yours, upload",
};

/** "Yours" isn't a source value — it switches the listing to the user's own references. */
const MINE = "mine";

function provenanceBadge(ref: DiscoverReference): string {
  const label = SOURCE_LABELS[ref.source] ?? ref.source;
  // "Winner" signal is limited to what's actually measured — days running
  // and variant count — and only shown when known, never implied.
  const parts = [label];
  if (ref.format === "image") parts.push("Image");
  if (ref.format === "video") parts.push("Video");
  if (ref.daysRunning != null) parts.push(`running ${ref.daysRunning} days`);
  if (ref.variantCount != null) parts.push(`${ref.variantCount} variants`);
  return parts.join(" / ");
}

/** Where to see the original ad. Meta ads link to the public Ad Library page, never the token-bearing snapshot. */
function originalLink(ref: DiscoverReference): string | null {
  if (ref.source === "meta_eu_uk") return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(ref.sourceRef)}`;
  if (ref.source === "user_url") return ref.sourceRef;
  return null;
}

function cardTitle(ref: DiscoverReference): string {
  if (ref.advertiser) return ref.advertiser;
  if (ref.source === "user_url") {
    try {
      return new URL(ref.sourceRef).hostname;
    } catch {
      return ref.sourceRef;
    }
  }
  if (ref.source === "user_upload") return "Your upload";
  return "Unknown advertiser";
}

function structureParts(ref: DiscoverReference): string[] {
  const s = ref.structure;
  if (!s) return [];
  return [s.hookType, s.offerType, s.layout].filter((p): p is string => Boolean(p)).map((p) => p.replace(/_/g, " "));
}

/** References are grouped by how the ad opens, because that is the part worth borrowing. */
function groupByHook(items: DiscoverReference[]): Array<{ hook: string | null; items: DiscoverReference[] }> {
  const groups = new Map<string, DiscoverReference[]>();
  for (const item of items) {
    const key = item.structure?.hookType ?? "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups.entries())
    .sort((x, y) => (x[0] === "" ? 1 : y[0] === "" ? -1 : y[1].length - x[1].length))
    .map(([hook, list]) => ({ hook: hook || null, items: list }));
}

export function DiscoverView({
  metaConfigured,
  vendorEnabled,
}: {
  metaConfigured: boolean;
  vendorEnabled: boolean;
}) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [format, setFormat] = useState("");
  const [category, setCategory] = useState("");
  const [minDaysRunning, setMinDaysRunning] = useState("");
  const [items, setItems] = useState<DiscoverReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (source === MINE) {
          params.set("scope", "mine");
        } else {
          if (source) params.set("source", source);
          if (category.trim()) params.set("category", category.trim());
          if (minDaysRunning.trim()) params.set("minDaysRunning", minDaysRunning.trim());
        }
        if (format === "image" || format === "video") params.set("format", format);

        const res = await fetch(`/api/references?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load references.");
          setItems([]);
          return;
        }
        setItems(data.items ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Could not load references.");
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }
    void run();
    return () => controller.abort();
  }, [source, format, category, minDaysRunning, reloadKey]);

  async function saved(res: Response) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaveError(data.error || "Could not save that reference.");
      return;
    }
    setNewUrl("");
    if (fileInput.current) fileInput.current.value = "";
    setSource(MINE);
    setReloadKey((k) => k + 1);
  }

  async function saveUrl() {
    if (!newUrl.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saved(
        await fetch("/api/references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: newUrl.trim() }),
        }),
      );
    } catch {
      setSaveError("Could not save that reference.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    setSaving(true);
    setSaveError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      await saved(await fetch("/api/references/upload", { method: "POST", body: form }));
    } catch {
      setSaveError("Could not upload that file.");
    } finally {
      setSaving(false);
    }
  }

  async function removeReference(ref: DiscoverReference) {
    if (!window.confirm(`Remove "${cardTitle(ref)}" from your references? Creatives made from it are kept.`)) return;
    const res = await fetch(`/api/references/${encodeURIComponent(ref.id)}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((r) => r.id !== ref.id));
    else setError("Could not remove that reference.");
  }

  const [usingSample, setUsingSample] = useState<string | null>(null);
  /** Saves a built-in sample as the user's own reference, then opens Studio with it. */
  async function openSample(id: string) {
    setUsingSample(id);
    setError(null);
    try {
      const res = await fetch("/api/references/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Could not open that sample.");
        return;
      }
      router.push(`/studio?reference=${encodeURIComponent(data.reference.id)}`);
    } catch {
      setError("Could not open that sample.");
    } finally {
      setUsingSample(null);
    }
  }

  const showingMine = source === MINE;
  const groups = groupByHook(items);

  return (
    <div className="vfade">
      <PageHeader
        kicker="Discover"
        title="What is running now, by how it opens"
        description="Ads that are live, grouped by their hook. Borrow the structure, not the ad: pick one and Studio will follow its shape for your product."
      />

      {!metaConfigured && (
        <Notice className="mb-5">
          Official coverage is not connected yet. When it is, it covers EU and UK ads on Meta and approved TikTok
          markets only, so US-only ads will not appear. You can add your own reference below now.
        </Notice>
      )}

      <section aria-label="Filters" className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-rule py-4 md:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Source</FieldLabel>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClasses}>
            <option value="">All official sources</option>
            <option value="meta_eu_uk">Meta EU/UK</option>
            <option value="tiktok_ccl">TikTok CCL</option>
            {vendorEnabled && <option value="vendor">Vendor feed</option>}
            <option value={MINE}>Yours</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Format</FieldLabel>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClasses}>
            <option value="">All formats</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Category</FieldLabel>
          <input
            value={category}
            disabled={showingMine}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="home goods"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Live for at least, days</FieldLabel>
          <input
            type="number"
            min={0}
            value={minDaysRunning}
            disabled={showingMine}
            onChange={(e) => setMinDaysRunning(e.target.value)}
            placeholder="0"
            className={`${inputClasses} font-mono`}
          />
        </label>
      </section>

      <section aria-label="Add your own reference" className="grid grid-cols-1 items-start gap-x-8 gap-y-2 border-b border-rule py-4 md:grid-cols-[200px_1fr]">
        <p className="kicker m-0 pt-3 text-ink">Add your own</p>
        <div className="flex max-w-[720px] flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveUrl();
              }}
              placeholder="Paste the link to an ad or a product page"
              aria-label="Ad or product page link"
              className={`${inputClasses} min-w-0 flex-1`}
            />
            <Button onClick={() => void saveUrl()} disabled={saving || !newUrl.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={saving}
            className="min-h-9 cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-ink underline underline-offset-4 disabled:opacity-40"
          >
            Or upload an image or video
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </div>
      </section>

      {error && (
        <Notice tone="error" className="mt-5">
          {error}
        </Notice>
      )}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="vz-shimmer aspect-square border border-dashed border-guide" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 && (
        <div className="grid grid-cols-1 gap-6 border-b border-rule py-10 md:grid-cols-[200px_1fr]">
          <p className="kicker m-0 text-ink">Nothing to show</p>
          <div>
            <p className="font-display m-0 text-[26px]">
              {showingMine ? "You have not saved a reference yet." : "No live ads match these filters."}
            </p>
            <p className="m-0 mt-2 max-w-[520px] text-[14px] text-ink-2">
              {showingMine
                ? "Paste a link or upload an image or video above. It stays private to your account."
                : "Loosen a filter, add an ad you like as your own reference, or start from one of the samples below."}
            </p>
          </div>
        </div>
      )}

      {/* Samples: only while there is nothing live to show, and always labelled. */}
      {!loading && !error && items.length === 0 && !showingMine ? (
        <section aria-label="Sample references" className="pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule pb-2">
            <h2 className="font-display m-0 text-[22px]">Samples to try it with</h2>
            <p className="m-0 font-mono text-[12px] text-muted">
              Fictional brands, drawn for Viralyz. Not real ads.
            </p>
          </div>
          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-7 pt-4 sm:grid-cols-3 lg:grid-cols-6">
            {SAMPLE_REFERENCES.map((sample) => (
              <article key={sample.id} className="flex min-w-0 flex-col">
                <div className="relative aspect-[4/5] overflow-hidden border border-rule bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sample.image}
                    alt={`Sample ad for ${sample.advertiser}, a fictional brand`}
                    className="h-full w-full object-contain"
                  />
                  <span className="absolute left-0 top-0 bg-ink px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-bg">
                    Sample
                  </span>
                </div>
                <div className="mt-2 truncate text-[14px] font-semibold text-ink">{sample.advertiser}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-2 first-letter:uppercase">
                  {[sample.structure.hookType, sample.structure.offerType, sample.structure.layout]
                    .filter((p) => p !== "none")
                    .map((p) => p.replace(/_/g, " "))
                    .join(", ")}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2.5 self-start"
                  onClick={() => void openSample(sample.id)}
                  disabled={usingSample !== null}
                >
                  {usingSample === sample.id ? "Opening…" : "Use this structure"}
                </Button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.hook ?? "none"} aria-label={group.hook ?? "Structure not read"} className="pt-8">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <h2 className="font-display m-0 text-[22px] first-letter:uppercase">
              {group.hook ? group.hook.replace(/_/g, " ") : "Structure not read yet"}
            </h2>
            <p className="m-0 font-mono text-[12px] text-muted">
              {group.hook ? "hook / " : ""}
              {group.items.length} {group.items.length === 1 ? "ad" : "ads"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 pt-4 sm:grid-cols-3 lg:grid-cols-5">
            {group.items.map((ref) => {
              const parts = structureParts(ref).filter((p) => p !== group.hook?.replace(/_/g, " "));
              return (
                <article key={ref.id} className="flex min-w-0 flex-col">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden border border-rule bg-card">
                    {ref.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ref.thumbnailUrl}
                        alt={ref.advertiser ?? "Reference ad"}
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <span className="hatch absolute inset-0 flex items-center justify-center">
                        <span className="bg-card px-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                          No preview
                        </span>
                      </span>
                    )}
                    {ref.daysRunning != null ? (
                      <span className="absolute bottom-0 left-0 bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg">
                        {ref.daysRunning} days live
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 truncate text-[14px] font-semibold text-ink">{cardTitle(ref)}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">{provenanceBadge(ref)}</div>
                  {parts.length > 0 ? (
                    <div className="mt-1 text-[12.5px] text-ink-2 first-letter:uppercase">{parts.join(", ")}</div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5">
                    <Button size="sm" onClick={() => router.push(`/studio?reference=${encodeURIComponent(ref.id)}`)}>
                      Use this structure
                    </Button>
                    {originalLink(ref) && (
                      <a
                        href={originalLink(ref)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                      >
                        Original
                      </a>
                    )}
                    {ref.source === "user_url" || ref.source === "user_upload" ? (
                      <button
                        type="button"
                        onClick={() => void removeReference(ref)}
                        className="min-h-9 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-mark underline underline-offset-4"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
