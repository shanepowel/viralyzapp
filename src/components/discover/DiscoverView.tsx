"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
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

function structureSummary(ref: DiscoverReference): string | null {
  const s = ref.structure;
  if (!s) return null;
  const parts = [s.hookType, s.offerType, s.layout].filter((p): p is string => Boolean(p));
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

  const showingMine = source === MINE;

  return (
    <div className="vfade">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Discover</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Browse running ads for structure and offer ideas, then use one as a reference in the
          Studio.
        </p>
      </div>

      {!metaConfigured && (
        <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5 mb-5">
          Official coverage isn&apos;t configured yet, and official sources only cover EU/UK (Meta)
          and approved TikTok markets — US-only ads aren&apos;t available here. Add your own
          reference below in the meantime.
        </div>
      )}

      <Panel className="mb-5">
        <div className="p-4 flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Add your own reference
          </span>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Paste an ad or product page URL"
              className="flex-1 min-w-[220px] rounded-[12px] border border-[var(--line-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]"
            />
            <Button size="sm" onClick={() => void saveUrl()} disabled={saving || !newUrl.trim()}>
              {saving ? "Saving…" : "Save link"}
            </Button>
            <span className="text-[12px] text-[var(--ink-3)]">or</span>
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={saving}>
              Upload an image
            </Button>
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
          </div>
          {saveError && <div className="text-[12.5px] text-[var(--s30)]">{saveError}</div>}
        </div>
      </Panel>

      <Panel className="mb-5">
        <div className="p-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Source
            </span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]"
            >
              <option value="">All official sources</option>
              <option value="meta_eu_uk">Meta EU/UK</option>
              <option value="tiktok_ccl">TikTok CCL</option>
              {vendorEnabled && <option value="vendor">Vendor feed</option>}
              <option value={MINE}>Yours</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Category
            </span>
            <input
              value={category}
              disabled={showingMine}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. home goods"
              className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Min days running
            </span>
            <input
              type="number"
              min={0}
              value={minDaysRunning}
              disabled={showingMine}
              onChange={(e) => setMinDaysRunning(e.target.value)}
              placeholder="0"
              className="w-[120px] rounded-[12px] border border-[var(--line-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]"
            />
          </label>
        </div>
      </Panel>

      {error && (
        <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <Panel>
          <div className="p-6 text-[13px] text-[var(--ink-2)]">
            {showingMine
              ? "You haven't added any references yet. Paste a link or upload an image above."
              : "Nothing matches these filters yet."}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((ref) => (
          <Panel key={ref.id}>
            <div className="p-4 flex flex-col gap-3">
              <div className="aspect-square rounded-[12px] bg-[var(--line)] overflow-hidden flex items-center justify-center">
                {ref.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ref.thumbnailUrl}
                    alt={ref.advertiser ?? "Reference ad"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[12px] text-[var(--ink-3)]">No preview</span>
                )}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--ink)] truncate">
                  {ref.advertiser ?? "Unknown advertiser"}
                </div>
                <div className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                  {provenanceBadge(ref)}
                </div>
                {structureSummary(ref) && (
                  <div className="text-[11.5px] text-[var(--ink-2)] mt-1">{structureSummary(ref)}</div>
                )}
                {originalLink(ref) && (
                  <a
                    href={originalLink(ref)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11.5px] text-[var(--violet-deep)] font-semibold"
                  >
                    View original
                  </a>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/studio?reference=${encodeURIComponent(ref.id)}`)}
              >
                Use as reference
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
