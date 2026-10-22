"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { VariantCard, type CreativeDTO } from "@/components/studio/VariantCard";

const PLACEMENTS = [
  { id: "meta_feed_1x1", label: "Meta Feed 1:1" },
  { id: "meta_feed_4x5", label: "Meta Feed 4:5" },
  { id: "story_9x16", label: "Story 9:16" },
  { id: "tiktok_9x16", label: "TikTok 9:16" },
] as const;

const ANGLES = [
  { id: "offer", label: "Offer" },
  { id: "problem", label: "Problem" },
  { id: "proof", label: "Proof" },
  { id: "demo", label: "Demo" },
] as const;

const POLL_INTERVAL_MS = 2000;

type ReferenceSummary = {
  id: string;
  source: string;
  sourceRef: string;
  advertiser: string | null;
  structure: { hookType: string | null; offerType: string | null; layout: string | null } | null;
};

function referenceLabel(ref: ReferenceSummary): string {
  if (ref.advertiser) return ref.advertiser;
  if (ref.source === "user_url") return ref.sourceRef.replace(/^https?:\/\//, "").slice(0, 60);
  if (ref.source === "user_upload") return "Uploaded image";
  return "Reference ad";
}

function referenceStructure(ref: ReferenceSummary): string {
  const s = ref.structure;
  const parts = s ? [s.hookType, s.offerType, s.layout].filter((p): p is string => Boolean(p)) : [];
  // Honest about what generation will actually get from this reference.
  return parts.length > 0 ? parts.join(" · ") : "No structure extracted yet — copy won't draw on it";
}

function placeholderCreative(
  id: string,
  angle: string,
  placement: string,
  productId: string,
): CreativeDTO {
  return {
    id,
    tag: "",
    angle,
    placement,
    productId,
    status: "pending",
    headline: null,
    compositeUrl: null,
    aiGenerated: true,
    checks: [],
  };
}

export function StudioView({
  initialReferenceId,
  generationAvailable,
}: {
  initialReferenceId: string | null;
  generationAvailable: boolean;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]["id"]>("meta_feed_1x1");
  const [angles, setAngles] = useState<string[]>(["offer"]);
  const [reference, setReference] = useState<ReferenceSummary | null>(null);
  const [myReferences, setMyReferences] = useState<ReferenceSummary[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [creatives, setCreatives] = useState<Record<string, CreativeDTO>>({});

  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadBrand() {
      const res = await fetch("/api/brand");
      const data = await res.json();
      if (cancelled) return;
      const product = data.brand?.products?.[0];
      if (!product) {
        setLoadError("Set up your brand and a product before generating.");
        return;
      }
      setProductId(product.id);
      setProductTitle(product.title);
    }
    void loadBrand();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadReferences() {
      const mine = await fetch("/api/references?scope=mine").then((r) => (r.ok ? r.json() : { items: [] }));
      if (cancelled) return;
      setMyReferences(mine.items ?? []);

      if (!initialReferenceId) return;
      const res = await fetch(`/api/references/${encodeURIComponent(initialReferenceId)}`);
      if (cancelled) return;
      if (!res.ok) {
        setReferenceError("That reference isn't available any more. Pick another or generate without one.");
        return;
      }
      setReference((await res.json()).reference);
    }
    void loadReferences().catch(() => {
      if (!cancelled) setReferenceError("Could not load references.");
    });
    return () => {
      cancelled = true;
    };
  }, [initialReferenceId]);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  function pollCreative(id: string) {
    async function tick() {
      const res = await fetch(`/api/studio/creatives/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreatives((prev) => ({ ...prev, [id]: toDTO(data.creative) }));
      if (data.creative.status === "pending" || data.creative.status === "generating") {
        pollTimers.current[id] = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      } else {
        delete pollTimers.current[id];
      }
    }
    void tick();
  }

  function toggleAngle(id: string) {
    setAngles((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function requestGeneration(requestAngles: string[]): Promise<string[] | null> {
    if (!productId) return null;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          referenceId: reference?.id,
          placement,
          angles: requestAngles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(
          data.error === "generation_unavailable"
            ? "Generation isn't configured yet — contact support."
            : data.error === "insufficient_credits"
              ? "Not enough credits for this many variants."
              : (data.error ?? "Could not start generation."),
        );
        return null;
      }
      return data.creativeIds as string[];
    } catch {
      setGenerateError("Could not start generation.");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function generate() {
    const ids = await requestGeneration(angles);
    if (!ids) return;
    setOrder((prev) => [...prev, ...ids]);
    setCreatives((prev) => {
      const next = { ...prev };
      ids.forEach((id, i) => {
        // requestGeneration already bailed out above if productId were null.
        next[id] = placeholderCreative(id, angles[i] ?? angles[0], placement, productId as string);
      });
      return next;
    });
    for (const id of ids) pollCreative(id);
  }

  async function regenerate(oldCreative: CreativeDTO) {
    const ids = await requestGeneration([oldCreative.angle]);
    if (!ids || ids.length === 0) return;
    const [newId] = ids;
    setOrder((prev) => prev.map((id) => (id === oldCreative.id ? newId : id)));
    setCreatives((prev) => {
      const next = { ...prev };
      delete next[oldCreative.id];
      next[newId] = placeholderCreative(newId, oldCreative.angle, oldCreative.placement, oldCreative.productId);
      return next;
    });
    pollCreative(newId);
  }

  const variantList = order.map((id) => creatives[id]).filter((c): c is CreativeDTO => Boolean(c));

  return (
    <div className="vfade">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Studio</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Pick a placement and up to four angles, then generate original ad variants.
        </p>
      </div>

      {loadError && (
        <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5 mb-5">
          {loadError}
        </div>
      )}

      <Panel className="mb-5">
        <div className="p-5 flex flex-col gap-4">
          <div className="text-[13px] text-[var(--ink-2)]">
            Product: <span className="font-semibold text-[var(--ink)]">{productTitle ?? "—"}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Reference (optional)
            </span>
            {reference ? (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--line-strong)] px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--ink)] truncate">{referenceLabel(reference)}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">{referenceStructure(reference)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setReference(null)}>
                  Clear
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {myReferences.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => setReference(myReferences.find((r) => r.id === e.target.value) ?? null)}
                    className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--violet)]"
                  >
                    <option value="">Pick one of yours…</option>
                    {myReferences.map((r) => (
                      <option key={r.id} value={r.id}>
                        {referenceLabel(r)}
                      </option>
                    ))}
                  </select>
                )}
                <Link href="/discover" className="text-[12.5px] text-[var(--violet-deep)] font-semibold">
                  Browse Discover or add your own
                </Link>
              </div>
            )}
            {referenceError && <div className="text-[12.5px] text-[var(--s30)]">{referenceError}</div>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Placement
            </span>
            <div className="flex flex-wrap gap-2">
              {PLACEMENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlacement(p.id)}
                  className="font-mono text-[12px] rounded-full px-3.5 py-1.5 border cursor-pointer"
                  style={
                    placement === p.id
                      ? { background: "var(--violet)", color: "#fff", borderColor: "var(--violet)" }
                      : { background: "var(--card)", color: "var(--ink)", borderColor: "var(--line-strong)" }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Angles
            </span>
            <div className="flex flex-wrap gap-2">
              {ANGLES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAngle(a.id)}
                  className="font-mono text-[12px] rounded-full px-3.5 py-1.5 border cursor-pointer"
                  style={
                    angles.includes(a.id)
                      ? { background: "var(--violet)", color: "#fff", borderColor: "var(--violet)" }
                      : { background: "var(--card)", color: "var(--ink)", borderColor: "var(--line-strong)" }
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {generateError && (
            <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
              {generateError}
            </div>
          )}

          {!generationAvailable && (
            <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
              Generation isn&apos;t available right now: the image provider or copy model isn&apos;t
              configured. Nothing will be queued or charged.
            </div>
          )}

          <Button
            onClick={() => void generate()}
            disabled={!generationAvailable || !productId || angles.length === 0 || generating}
          >
            {generating ? "Generating…" : `Generate (${angles.length} variant${angles.length === 1 ? "" : "s"})`}
          </Button>
        </div>
      </Panel>

      {variantList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {variantList.map((creative) => (
            <VariantCard
              key={creative.id}
              creative={creative}
              onRegenerate={() => void regenerate(creative)}
              regenerating={generating}
              regenerateDisabled={!generationAvailable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function toDTO(raw: {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  status: CreativeDTO["status"];
  headline: string | null;
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
    status: raw.status,
    headline: raw.headline,
    compositeUrl: raw.compositeUrl,
    aiGenerated: raw.aiGenerated,
    checks: raw.checks.map((c) => ({
      headline: c.headline,
      headlineBasis: c.headlineBasis as { counted: number; total: number },
      factors: c.factors as CreativeDTO["checks"][number]["factors"],
    })),
  };
}
