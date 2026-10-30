"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

type DiscoverReference = {
  id: string;
  source: string;
  sourceRef: string;
  advertiser: string | null;
  daysRunning: number | null;
  variantCount: number | null;
  thumbnailUrl: string | null;
  structure: { hookType: string | null; offerType: string | null; layout: string | null } | null;
};

const SOURCE_LABELS: Record<string, string> = {
  meta_eu_uk: "Meta EU/UK",
  tiktok_ccl: "TikTok CCL",
  vendor: "Vendor feed",
  user_url: "Yours · link",
  user_upload: "Yours · upload",
};

/** "Yours" isn't a source value — it switches the listing to the user's own references. */
const MINE = "mine";

function provenanceBadge(ref: DiscoverReference): string {
  const label = SOURCE_LABELS[ref.source] ?? ref.source;
  // "Winner" signal is limited to what's actually measured — days running
  // and variant count — and only shown when known, never implied.
  const parts = [label];
  if (ref.daysRunning != null) parts.push(`running ${ref.daysRunning} days`);
  if (ref.variantCount != null) parts.push(`${ref.variantCount} variants`);
  return parts.join(" · ");
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

function structureSummary(ref: DiscoverReference): string | null {
  const s = ref.structure;
  if (!s) return null;
  const parts = [s.hookType, s.offerType, s.layout]
    .filter((p): p is string => Boolean(p))
    .map((p) => p.replace(/_/g, " "));
  return parts.length > 0 ? parts.join(" · ") : null;
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
  }, [source, category, minDaysRunning, reloadKey]);

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
      setSaveError("Could not upload that image.");
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

  const showingMine = source === MINE;

  return (
    <div className="vfade">
      <PageHeader
        title="Discover"
        description="Ads that are running now, for structure and offer ideas. Pick one and use it as a reference in the Studio."
      />

      {!metaConfigured && (
        <Notice className="mb-5">
          Official coverage isn&apos;t configured yet, and official sources only cover EU/UK (Meta)
          and approved TikTok markets, so US-only ads aren&apos;t available here. Add your own
          reference below in the meantime.
        </Notice>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,440px)] gap-4 mb-6 items-start">
        <Panel tone="panel">
          <div className="p-4 flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1.5 min-w-[180px] flex-1">
              <FieldLabel>Source</FieldLabel>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClasses}>
                <option value="">All official sources</option>
                <option value="meta_eu_uk">Meta EU/UK</option>
                <option value="tiktok_ccl">TikTok CCL</option>
                {vendorEnabled && <option value="vendor">Vendor feed</option>}
                <option value={MINE}>Yours</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 min-w-[160px] flex-1">
              <FieldLabel>Category</FieldLabel>
              <input
                value={category}
                disabled={showingMine}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. home goods"
                className={inputClasses}
              />
            </label>

            <label className="flex flex-col gap-1.5 w-[140px]">
              <FieldLabel>Min days running</FieldLabel>
              <input
                type="number"
                min={0}
                value={minDaysRunning}
                disabled={showingMine}
                onChange={(e) => setMinDaysRunning(e.target.value)}
                placeholder="0"
                className={inputClasses}
              />
            </label>
          </div>
        </Panel>

        <Panel>
          <div className="p-4 flex flex-col gap-2">
            <FieldLabel>Add your own reference</FieldLabel>
            <div className="flex gap-2">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveUrl();
                }}
                placeholder="Paste an ad or product page URL"
                aria-label="Ad or product page URL"
                className={`${inputClasses} flex-1 min-w-0`}
              />
              <Button size="md" onClick={() => void saveUrl()} disabled={saving || !newUrl.trim()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={saving}
              className="self-start bg-transparent border-none p-0 text-[13px] font-semibold text-ink underline underline-offset-4 cursor-pointer disabled:opacity-40"
            >
              Or upload an image
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            {saveError && <Notice tone="error">{saveError}</Notice>}
          </div>
        </Panel>
      </div>

      {error && (
        <Notice tone="error" className="mb-5">
          {error}
        </Notice>
      )}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-card border border-line bg-panel aspect-[4/5] vz-shimmer" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-panel border border-line bg-panel dots min-h-[260px] flex items-center justify-center p-8 text-center">
          <div>
            <div className="font-semibold text-[15px]">
              {showingMine ? "No references of your own yet" : "Nothing matches these filters yet"}
            </div>
            <p className="m-0 mt-1 text-[13px] text-muted">
              {showingMine
                ? "Paste a link or upload an image above."
                : "Try another source, or add an ad you like as your own reference."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((ref) => (
          <article key={ref.id} className="bg-card border border-line rounded-card overflow-hidden flex flex-col">
            <div className="relative bg-panel dots aspect-square flex items-center justify-center overflow-hidden">
              {ref.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ref.thumbnailUrl}
                  alt={ref.advertiser ?? "Reference ad"}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <span className="text-[12px] text-muted">No preview</span>
              )}
              {ref.daysRunning != null ? (
                <span className="absolute left-3 bottom-3 rounded-full bg-inv text-inv-ink px-2.5 py-1 text-[12px] font-semibold tabular">
                  {ref.daysRunning} days live
                </span>
              ) : null}
            </div>
            <div className="p-4 flex flex-col gap-3 flex-1">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">{cardTitle(ref)}</div>
                <div className="text-[12px] text-muted mt-0.5">{provenanceBadge(ref)}</div>
                {structureSummary(ref) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {structureSummary(ref)!
                      .split(" · ")
                      .map((part) => (
                        <span key={part} className="rounded-full bg-panel px-2.5 py-0.5 text-[12px] text-ink">
                          {part}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push(`/studio?reference=${encodeURIComponent(ref.id)}`)}
                >
                  Use as reference
                </Button>
                {originalLink(ref) && (
                  <a
                    href={originalLink(ref)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-semibold text-ink underline underline-offset-4"
                  >
                    View original
                  </a>
                )}
                {ref.source === "user_url" || ref.source === "user_upload" ? (
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void removeReference(ref)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
