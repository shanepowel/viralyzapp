"use client";

import { useEffect, useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PLACEMENT_LABELS, VariantCard, type CreativeDTO } from "@/components/studio/VariantCard";

type Filter = "all" | "passing" | "attention";

function needsAttention(c: CreativeDTO): boolean {
  if (c.status === "failed") return true;
  return (c.checks[0]?.factors ?? []).some((f) => f.status === "scored" && f.kind !== "model" && !f.passed);
}

const POLL_INTERVAL_MS = 2000;

export function CreativesView({
  initialCreatives,
  generationAvailable,
}: {
  initialCreatives: CreativeDTO[];
  generationAvailable: boolean;
}) {
  const [creatives, setCreatives] = useState<CreativeDTO[]>(initialCreatives);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placement, setPlacement] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () =>
      creatives.filter((c) => {
        if (placement !== "all" && c.placement !== placement) return false;
        if (filter === "passing") return c.status === "ready" && !needsAttention(c);
        if (filter === "attention") return needsAttention(c);
        return true;
      }),
    [creatives, placement, filter],
  );
  const placementsUsed = Array.from(new Set(creatives.map((c) => c.placement)));

  function pollCreative(id: string) {
    async function tick() {
      const res = await fetch(`/api/studio/creatives/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreatives((prev) => prev.map((c) => (c.id === id ? toDTO(data.creative) : c)));
      if (data.creative.status === "pending" || data.creative.status === "generating") {
        setTimeout(() => void tick(), POLL_INTERVAL_MS);
      }
    }
    void tick();
  }

  useEffect(() => {
    for (const creative of initialCreatives) {
      if (creative.status === "pending" || creative.status === "generating") {
        pollCreative(creative.id);
      }
    }
    // Poll each open creative from the server render. Regenerations poll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerate(creative: CreativeDTO) {
    setRegeneratingId(creative.id);
    setError(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: creative.productId,
          referenceId: creative.referenceId ?? undefined,
          placement: creative.placement,
          angles: [creative.angle],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "insufficient_credits" ? "Not enough credits to regenerate." : "Could not regenerate.",
        );
        return;
      }
      const [newId] = data.creativeIds as string[];
      setCreatives((prev) => [
        {
          ...creative,
          id: newId,
          tag: "",
          status: "pending",
          headline: null,
          primaryText: null,
          cta: null,
          compositeUrl: null,
          checks: [],
        },
        ...prev.filter((c) => c.id !== creative.id),
      ]);
      pollCreative(newId);
    } finally {
      setRegeneratingId(null);
    }
  }

  if (creatives.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-panel dots min-h-[320px] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div>
          <div className="font-semibold text-[15px]">Nothing generated yet</div>
          <p className="m-0 mt-1 text-[13px] text-muted">Make your first variants in the Studio.</p>
        </div>
        <ButtonLink href="/studio">Open Studio</ButtonLink>
      </div>
    );
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: `All ${creatives.length}` },
    { id: "passing", label: "All checks passed" },
    { id: "attention", label: "Needs a fix" },
  ];

  return (
    <div className="vfade">
      {!generationAvailable && (
        <Notice className="mb-5">
          Regenerating isn&apos;t available right now: the image provider or copy model isn&apos;t configured.
        </Notice>
      )}
      {error && (
        <Notice tone="error" className="mb-5">
          {error}
        </Notice>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Filter by checks" className="flex flex-wrap gap-1 rounded-full bg-panel p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-8 rounded-full px-3.5 text-[13px] font-semibold border-none cursor-pointer ${
                filter === f.id ? "bg-card text-ink shadow-float" : "bg-transparent text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {placementsUsed.length > 1 ? (
          <select
            aria-label="Filter by placement"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            className="min-h-10 rounded-full border border-line bg-card px-3.5 text-[13px] font-semibold"
          >
            <option value="all">All placements</option>
            {placementsUsed.map((p) => (
              <option key={p} value={p}>
                {PLACEMENT_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <p className="text-[13px] text-muted">Nothing matches this filter.</p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((creative) => (
          <VariantCard
            key={creative.id}
            creative={creative}
            onRegenerate={() => void regenerate(creative)}
            regenerating={regeneratingId === creative.id}
            regenerateDisabled={!generationAvailable}
          />
        ))}
      </div>
    </div>
  );
}

function toDTO(raw: {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  referenceId: string | null;
  status: CreativeDTO["status"];
  headline: string | null;
  primaryText: string | null;
  cta: string | null;
  compositeUrl: string | null;
  aiGenerated: boolean;
  checks: Array<{ headline: number | null; headlineBasis: unknown; factors: unknown }>;
}): CreativeDTO {
  return {
    id: raw.id,
    tag: raw.tag,
    angle: raw.angle,
    placement: raw.placement,
    productId: raw.productId,
    referenceId: raw.referenceId,
    status: raw.status,
    headline: raw.headline,
    primaryText: raw.primaryText,
    cta: raw.cta,
    compositeUrl: raw.compositeUrl,
    aiGenerated: raw.aiGenerated,
    checks: raw.checks.map((c) => ({
      headline: c.headline,
      headlineBasis: c.headlineBasis as { counted: number; total: number },
      factors: c.factors as CreativeDTO["checks"][number]["factors"],
    })),
  };
}
