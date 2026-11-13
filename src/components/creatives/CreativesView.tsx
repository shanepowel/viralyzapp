"use client";

import { useEffect, useMemo, useState } from "react";
import { ProofTile } from "@/components/studio/AdProof";
import { ProofDesk } from "@/components/studio/ProofDesk";
import {
  ANGLE_LABELS,
  PLACEMENT_LABELS,
  readProof,
  toCreativeDTO,
  type CreativeDTO,
} from "@/components/studio/proof";
import { ButtonLink } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";

type Filter = "all" | "cleared" | "marked";

function isMarked(c: CreativeDTO): boolean {
  const v = readProof(c).verdict;
  return v === "fix" || v === "blocked" || v === "failed";
}

const POLL_INTERVAL_MS = 2000;

export function CreativesView({
  initialCreatives,
  generationAvailable,
  creditsPerVariant,
}: {
  initialCreatives: CreativeDTO[];
  generationAvailable: boolean;
  creditsPerVariant?: number;
}) {
  const [creatives, setCreatives] = useState<CreativeDTO[]>(initialCreatives);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placement, setPlacement] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      cleared: creatives.filter((c) => readProof(c).verdict === "cleared").length,
      marked: creatives.filter(isMarked).length,
    }),
    [creatives],
  );
  const visible = useMemo(
    () =>
      creatives.filter((c) => {
        if (placement !== "all" && c.placement !== placement) return false;
        if (filter === "cleared") return readProof(c).verdict === "cleared";
        if (filter === "marked") return isMarked(c);
        return true;
      }),
    [creatives, placement, filter],
  );
  const placementsUsed = Array.from(new Set(creatives.map((c) => c.placement)));
  const open = creatives.find((c) => c.id === openId) ?? null;

  function pollCreative(id: string) {
    async function tick() {
      const res = await fetch(`/api/studio/creatives/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreatives((prev) => prev.map((c) => (c.id === id ? toCreativeDTO(data.creative) : c)));
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
          data.error === "insufficient_credits"
            ? "Not enough credits to make it again. Nothing was charged."
            : "Could not make it again.",
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
      setOpenId(newId);
      pollCreative(newId);
    } catch {
      setError("Could not make it again.");
    } finally {
      setRegeneratingId(null);
    }
  }

  if (creatives.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-6 border-y border-rule py-10 md:grid-cols-[200px_1fr]">
        <p className="kicker m-0 text-ink">Nothing here yet</p>
        <div>
          <p className="font-display m-0 text-[26px]">Every ad you make is kept here with its check.</p>
          <p className="m-0 mt-2 max-w-[520px] text-[14px] text-ink-2">
            Start a batch in Studio. The proofs land on this sheet, cleared or marked.
          </p>
          <ButtonLink href="/studio?new=1" className="mt-5">
            New batch
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="vfade">
      {!generationAvailable && (
        <Notice className="mb-5">
          Making ads again is switched off for now: the image provider or the copy model is not configured.
        </Notice>
      )}
      {error && (
        <Notice tone="error" className="mb-5">
          {error}
        </Notice>
      )}

      {open ? (
        <div className="mb-8">
          <div className="flex justify-end pb-2">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="min-h-9 cursor-pointer border-0 bg-transparent font-mono text-[11px] uppercase tracking-[0.06em] text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              Close proof
            </button>
          </div>
          <ProofDesk
            key={open.id}
            creative={open}
            onRegenerate={() => void regenerate(open)}
            regenerating={regeneratingId === open.id}
            regenerateDisabled={!generationAvailable}
            creditsPerVariant={creditsPerVariant}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-3">
        <Segmented
          label="Filter by check result"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${creatives.length}` },
            { value: "cleared", label: `Cleared ${counts.cleared}` },
            { value: "marked", label: `Marked ${counts.marked}` },
          ]}
        />
        {placementsUsed.length > 1 ? (
          <select
            aria-label="Filter by placement"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            className={`${inputClasses} !min-h-10 !w-auto text-[13px]`}
          >
            <option value="all">All placements</option>
            {placementsUsed.map((p) => (
              <option key={p} value={p}>
                {PLACEMENT_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        ) : null}
        <p className="m-0 ml-auto font-mono text-[12px] text-muted" aria-live="polite">
          Showing {visible.length} of {creatives.length}
        </p>
      </div>

      {visible.length === 0 ? <p className="mt-6 text-[14px] text-ink-2">Nothing matches this filter.</p> : null}

      <div className="grid grid-cols-2 items-end gap-x-4 gap-y-6 pt-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((creative) => (
          <ProofTile
            key={creative.id}
            creative={creative}
            selected={creative.id === openId}
            onSelect={() => {
              setOpenId(creative.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            caption={`${ANGLE_LABELS[creative.angle] ?? creative.angle} ${creative.tag}`}
          />
        ))}
      </div>
    </div>
  );
}
