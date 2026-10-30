"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { VariantCard, type CreativeDTO } from "@/components/studio/VariantCard";

const PLACEMENTS = [
  { id: "meta_feed_1x1", label: "Meta feed 1:1", ratio: "1 / 1" },
  { id: "meta_feed_4x5", label: "Meta feed 4:5", ratio: "4 / 5" },
  { id: "story_9x16", label: "Story 9:16", ratio: "9 / 16" },
  { id: "tiktok_9x16", label: "TikTok 9:16", ratio: "9 / 16" },
] as const;

const ANGLES = [
  { id: "offer", label: "Offer", hint: "Lead with the deal" },
  { id: "problem", label: "Problem", hint: "Name the pain first" },
  { id: "proof", label: "Proof", hint: "Show why to believe it" },
  { id: "demo", label: "Demo", hint: "Show the product working" },
] as const;

type ProductSummary = { id: string; title: string };

/** A selectable pill: black when on, hairline when off. */
function ChoicePill({
  selected,
  onClick,
  children,
  role,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold cursor-pointer transition-colors ${
        selected ? "bg-btn text-btn-ink border-btn" : "bg-card text-ink border-line hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

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
  const parts = s
    ? [s.hookType, s.offerType, s.layout].filter((p): p is string => Boolean(p)).map((p) => p.replace(/_/g, " "))
    : [];
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
  creditsPerVariant,
}: {
  initialReferenceId: string | null;
  generationAvailable: boolean;
  creditsPerVariant: number;
}) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
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
      const list: ProductSummary[] = (data.brand?.products ?? []).map((p: ProductSummary) => ({
        id: p.id,
        title: p.title,
      }));
      if (list.length === 0) {
        setLoadError("Set up your brand and a product before generating.");
        return;
      }
      setProducts(list);
      setProductId(list[0].id);
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
  const cost = angles.length * creditsPerVariant;
  const placementInfo = PLACEMENTS.find((p) => p.id === placement)!;

  return (
    <div className="vfade">
      <PageHeader
        title="Studio"
        description="Pick a product, a placement and up to four angles. Every variant is pre-flighted the moment it's made."
        actions={
          <ButtonLink href="/creatives" variant="outline" size="sm">
            All creatives
          </ButtonLink>
        }
      />

      {loadError ? (
        <Notice tone="error" className="mb-5">
          {loadError}{" "}
          <Link href="/brand" className="font-semibold underline underline-offset-4">
            Set up brand
          </Link>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-6 items-start">
        <Panel className="lg:sticky lg:top-6">
          <div className="p-5 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Product</FieldLabel>
              <select
                value={productId ?? ""}
                onChange={(e) => setProductId(e.target.value)}
                disabled={products.length === 0}
                className={inputClasses}
              >
                {products.length === 0 ? <option value="">No products yet</option> : null}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Reference (optional)</FieldLabel>
              {reference ? (
                <div className="flex items-center gap-3 rounded-inner border border-line bg-panel px-3.5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink truncate">{referenceLabel(reference)}</div>
                    <div className="text-[12px] text-muted">{referenceStructure(reference)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setReference(null)}>
                    Clear
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {myReferences.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => setReference(myReferences.find((r) => r.id === e.target.value) ?? null)}
                      className={inputClasses}
                    >
                      <option value="">Pick one of yours…</option>
                      {myReferences.map((r) => (
                        <option key={r.id} value={r.id}>
                          {referenceLabel(r)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Link href="/discover" className="text-[13px] font-semibold text-ink underline underline-offset-4">
                    Browse Discover or add your own
                  </Link>
                </div>
              )}
              {referenceError ? <p className="m-0 text-[12.5px] text-muted">{referenceError}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel>Placement</FieldLabel>
              <div role="radiogroup" aria-label="Placement" className="flex flex-wrap gap-2">
                {PLACEMENTS.map((p) => (
                  <ChoicePill key={p.id} role="radio" selected={placement === p.id} onClick={() => setPlacement(p.id)}>
                    <span
                      aria-hidden="true"
                      className="inline-block w-2.5 rounded-[2px] border-[1.5px] border-current"
                      style={{ aspectRatio: p.ratio }}
                    />
                    {p.label}
                  </ChoicePill>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel>Angles</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {ANGLES.map((a) => {
                  const on = angles.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleAngle(a.id)}
                      className={`text-left rounded-inner border px-3.5 py-2.5 cursor-pointer transition-colors ${
                        on ? "border-ink bg-panel" : "border-line bg-card hover:border-muted"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-ink">
                        {a.label}
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            on ? "bg-ink text-bg" : "border border-line"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </span>
                      </span>
                      <span className="block text-[12px] text-muted mt-0.5">{a.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {generateError ? <Notice tone="error">{generateError}</Notice> : null}

            {!generationAvailable ? (
              <Notice>
                Generation isn&apos;t available right now: the image provider or copy model isn&apos;t
                configured. Nothing will be queued or charged.
              </Notice>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <Button
                onClick={() => void generate()}
                disabled={!generationAvailable || !productId || angles.length === 0 || generating}
              >
                {generating
                  ? "Generating…"
                  : `Generate ${angles.length} variant${angles.length === 1 ? "" : "s"}`}
              </Button>
              <p className="m-0 text-center text-[12px] text-muted tabular">
                {cost} credit{cost === 1 ? "" : "s"} · {placementInfo.label}
              </p>
            </div>
          </div>
        </Panel>

        <section aria-label="Variants" aria-live="polite">
          {variantList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          ) : (
            <div className="rounded-panel border border-line bg-panel dots min-h-[420px] flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div
                aria-hidden="true"
                className="w-[120px] rounded-inner border border-dashed border-line-strong bg-card"
                style={{ aspectRatio: placementInfo.ratio }}
              />
              <div>
                <div className="font-semibold text-[15px]">Your variants land here</div>
                <p className="m-0 mt-1 max-w-[360px] text-[13px] text-muted">
                  Each one is checked for contrast, safe zone, ratio, copy length and policy before you
                  spend on it.
                </p>
              </div>
            </div>
          )}
        </section>
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
