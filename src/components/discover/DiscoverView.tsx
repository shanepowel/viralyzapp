"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

type DiscoverReference = {
  id: string;
  source: string;
  advertiser: string | null;
  daysRunning: number | null;
  variantCount: number | null;
  thumbnailUrl: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  meta_eu_uk: "Meta EU/UK",
  tiktok_ccl: "TikTok CCL",
  vendor: "Vendor feed",
};

function provenanceBadge(ref: DiscoverReference): string {
  const label = SOURCE_LABELS[ref.source] ?? ref.source;
  // "Winner" signal is limited to what's actually measured — days running
  // and variant count — and only shown when known, never implied.
  const parts = [label];
  if (ref.daysRunning != null) parts.push(`running ${ref.daysRunning} days`);
  if (ref.variantCount != null) parts.push(`${ref.variantCount} variants`);
  return parts.join(" · ");
}

export function DiscoverView({ metaConfigured }: { metaConfigured: boolean }) {
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [minDaysRunning, setMinDaysRunning] = useState("");
  const [items, setItems] = useState<DiscoverReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (source) params.set("source", source);
        if (category.trim()) params.set("category", category.trim());
        if (minDaysRunning.trim()) params.set("minDaysRunning", minDaysRunning.trim());

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
  }, [source, category, minDaysRunning]);

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
          and approved TikTok markets — US-only ads aren&apos;t available here. Paste your own
          reference URL from the Studio in the meantime.
        </div>
      )}

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
              <option value="">All sources</option>
              <option value="meta_eu_uk">Meta EU/UK</option>
              <option value="tiktok_ccl">TikTok CCL</option>
              <option value="vendor">Vendor feed</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Category
            </span>
            <input
              value={category}
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
            Nothing matches these filters yet.
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
              </div>
              <Button size="sm" variant="outline">
                Use as reference
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
