"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProofTile } from "@/components/studio/AdProof";
import { ProofDesk } from "@/components/studio/ProofDesk";
import {
  ANGLE_HINTS,
  ANGLE_LABELS,
  ANGLE_ORDER,
  PLACEMENT_LABELS,
  PLACEMENT_ORDER,
  PLACEMENT_RATIO,
  readProof,
  requestFix,
  toCreativeDTO,
  type AngleId,
  type CreativeDTO,
  type FixAction,
  type PlacementId,
} from "@/components/studio/proof";
import { Button, ButtonLink } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";

type ProductSummary = { id: string; title: string };

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
  return parts.length > 0 ? parts.join(" / ") : "No structure read from it yet, so the copy will not draw on it";
}

function placeholderCreative(id: string, angle: string, placement: string, productId: string): CreativeDTO {
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

/** A square tick box that reads as a form control, not a pill. */
function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center border border-rule ${on ? "bg-ink" : "bg-card"}`}
    >
      {on ? (
        <svg width="10" height="10" viewBox="0 0 14 14">
          <path d="M2 7.5l3.2 3.2L12 3.5" fill="none" stroke="var(--vz-bg)" strokeWidth="2.4" strokeLinecap="square" />
        </svg>
      ) : null}
    </span>
  );
}

/** One line of the brief: a numbered label on the left, the control on the right. */
function BriefRow({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 border-b border-line py-5 md:grid-cols-[200px_1fr]">
      <p className="kicker m-0 pt-1 text-ink">
        <span className="text-muted">{n} </span>
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StudioView({
  initialReferenceId,
  generationAvailable,
  creditsPerVariant,
  recent = [],
  startNew = false,
}: {
  initialReferenceId: string | null;
  generationAvailable: boolean;
  creditsPerVariant: number;
  /** The newest ads on the account, so the desk opens on the last batch. */
  recent?: CreativeDTO[];
  startNew?: boolean;
}) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [placements, setPlacements] = useState<PlacementId[]>(["meta_feed_1x1"]);
  const [angles, setAngles] = useState<AngleId[]>(["offer"]);
  const [reference, setReference] = useState<ReferenceSummary | null>(null);
  const [myReferences, setMyReferences] = useState<ReferenceSummary[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(() => recent.map((c) => c.id));
  const [creatives, setCreatives] = useState<Record<string, CreativeDTO>>(() =>
    Object.fromEntries(recent.map((c) => [c.id, c])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(recent[0]?.id ?? null);
  const [briefOpen, setBriefOpen] = useState(startNew || recent.length === 0 || Boolean(initialReferenceId));

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
        setLoadError("A batch needs a confirmed brand and at least one product.");
        return;
      }
      setProducts(list);
      setProductId(list[0].id);
    }
    void loadBrand().catch(() => {
      if (!cancelled) setLoadError("Could not load your brand. Reload the page to try again.");
    });
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
        setReferenceError("That reference is no longer available. Pick another, or make the batch without one.");
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

  function pollCreative(id: string) {
    async function tick() {
      const res = await fetch(`/api/studio/creatives/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreatives((prev) => ({ ...prev, [id]: toCreativeDTO(data.creative) }));
      if (data.creative.status === "pending" || data.creative.status === "generating") {
        pollTimers.current[id] = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      } else {
        delete pollTimers.current[id];
      }
    }
    void tick();
  }

  useEffect(() => {
    const timers = pollTimers.current;
    for (const c of recent) {
      if (c.status === "pending" || c.status === "generating") pollCreative(c.id);
    }
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
    // Poll the open ads from the server render once. New ones poll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle<T>(list: T[], id: T): T[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function describeError(code: unknown): string {
    if (code === "generation_unavailable") return "Making ads is switched off: the image or copy service is not configured.";
    if (code === "insufficient_credits") return "Not enough credits for a batch this size. Nothing was charged.";
    return typeof code === "string" && code ? code : "Could not start the batch.";
  }

  /** One request per placement: the API makes one placement at a time. */
  async function request(
    forProduct: string,
    placement: string,
    requestAngles: string[],
    referenceId: string | undefined,
  ): Promise<{ ids: string[] } | { error: string }> {
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: forProduct, referenceId, placement, angles: requestAngles }),
      });
      const data = await res.json();
      if (!res.ok) return { error: describeError(data.error) };
      return { ids: data.creativeIds as string[] };
    } catch {
      return { error: "Could not start the batch." };
    }
  }

  async function generate() {
    if (!productId) return;
    setGenerating(true);
    setGenerateError(null);
    const orderedAngles = ANGLE_ORDER.filter((a) => angles.includes(a));
    const orderedPlacements = PLACEMENT_ORDER.filter((p) => placements.includes(p));
    const made: CreativeDTO[] = [];
    let failure: string | null = null;
    for (const placement of orderedPlacements) {
      const result = await request(productId, placement, orderedAngles, reference?.id);
      if ("error" in result) {
        failure = result.error;
        break;
      }
      result.ids.forEach((id, i) => {
        made.push(placeholderCreative(id, orderedAngles[i] ?? orderedAngles[0], placement, productId));
      });
    }
    setGenerating(false);

    if (made.length > 0) {
      // A new batch replaces what is on the desk; the old ads stay in Creatives.
      setOrder(made.map((c) => c.id));
      setCreatives(Object.fromEntries(made.map((c) => [c.id, c])));
      setSelectedId(made[0].id);
      setBriefOpen(false);
      for (const c of made) pollCreative(c.id);
    }
    if (failure) {
      setGenerateError(
        made.length > 0
          ? `${failure} ${made.length} of ${orderedAngles.length * orderedPlacements.length} ads were started.`
          : failure,
      );
    }
  }

  async function regenerate(old: CreativeDTO) {
    setGenerating(true);
    setGenerateError(null);
    const result = await request(old.productId, old.placement, [old.angle], old.referenceId ?? reference?.id);
    setGenerating(false);
    if ("error" in result) {
      setGenerateError(result.error);
      return;
    }
    const [newId] = result.ids;
    if (!newId) return;
    setOrder((prev) => prev.map((id) => (id === old.id ? newId : id)));
    setCreatives((prev) => {
      const next = { ...prev };
      delete next[old.id];
      next[newId] = placeholderCreative(newId, old.angle, old.placement, old.productId);
      return next;
    });
    setSelectedId(newId);
    pollCreative(newId);
  }

  const [fixingId, setFixingId] = useState<string | null>(null);
  async function fix(target: CreativeDTO, action: FixAction) {
    setFixingId(target.id);
    setGenerateError(null);
    const result = await requestFix(target.id, action);
    setFixingId(null);
    if ("error" in result) {
      setGenerateError(result.error);
      return;
    }
    setCreatives((prev) => ({ ...prev, [target.id]: result.creative }));
  }

  const sheet = useMemo(
    () => order.map((id) => creatives[id]).filter((c): c is CreativeDTO => Boolean(c)),
    [order, creatives],
  );
  const selected = sheet.find((c) => c.id === selectedId) ?? sheet[0] ?? null;
  const count = angles.length * placements.length;
  const cost = count * creditsPerVariant;

  // The contact sheet: one row per angle, one column per placement.
  const rows = ANGLE_ORDER.filter((a) => sheet.some((c) => c.angle === a));
  const cols = PLACEMENT_ORDER.filter((p) => sheet.some((c) => c.placement === p));
  const tally = sheet.reduce(
    (t, c) => {
      const v = readProof(c).verdict;
      if (v === "cleared") t.cleared += 1;
      else if (v === "fix") t.fix += 1;
      else if (v === "blocked") t.blocked += 1;
      else if (v === "checking") t.checking += 1;
      return t;
    },
    { cleared: 0, fix: 0, blocked: 0, checking: 0 },
  );

  const showBrief = briefOpen || sheet.length === 0;

  return (
    <div className="vfade">
      <PageHeader
        kicker="Studio"
        title={showBrief ? "New batch" : "Review desk"}
        description={
          showBrief
            ? "Say what to make. Every ad is checked against the placement's rules the moment it exists, and anything that must change is marked on the proof."
            : "Red marks are what must change. Blue is the platform's safe zone. Green means cleared."
        }
        actions={
          sheet.length > 0 && showBrief ? (
            <Button variant="outline" size="sm" onClick={() => setBriefOpen(false)}>
              Back to the desk
            </Button>
          ) : (
            <ButtonLink href="/creatives" variant="outline" size="sm">
              All creatives
            </ButtonLink>
          )
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
      {generateError ? (
        <Notice tone="error" className="mb-5">
          {generateError}
        </Notice>
      ) : null}
      {!generationAvailable ? (
        <Notice className="mb-5">
          Making ads is switched off for now: the image provider or the copy model is not configured. Nothing will be
          queued or charged.
        </Notice>
      ) : null}

      {showBrief ? (
        <section aria-label="Brief" className="border-t border-rule">
          <BriefRow n={1} label="Product">
            <select
              aria-label="Product"
              value={productId ?? ""}
              onChange={(e) => setProductId(e.target.value)}
              disabled={products.length === 0}
              className={`${inputClasses} max-w-[520px]`}
            >
              {products.length === 0 ? <option value="">No products yet</option> : null}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </BriefRow>

          <BriefRow n={2} label="Where it runs">
            <div role="group" aria-label="Placements" className="grid max-w-[720px] grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
              {PLACEMENT_ORDER.map((p) => {
                const on = placements.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setPlacements((prev) => toggle(prev, p))}
                    className={`flex min-h-[92px] cursor-pointer flex-col justify-between border-0 p-3 text-left ${
                      on ? "bg-card" : "bg-bg hover:bg-panel"
                    }`}
                  >
                    <span className="flex w-full items-start justify-between">
                      <span
                        aria-hidden="true"
                        className={`inline-block h-7 border ${on ? "border-ink bg-ink" : "border-muted"}`}
                        style={{ aspectRatio: PLACEMENT_RATIO[p] }}
                      />
                      <Tick on={on} />
                    </span>
                    <span className={`text-[13px] ${on ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                      {PLACEMENT_LABELS[p]}
                    </span>
                  </button>
                );
              })}
            </div>
          </BriefRow>

          <BriefRow n={3} label="Angles">
            <div role="group" aria-label="Angles" className="max-w-[720px] border-t border-rule">
              {ANGLE_ORDER.map((a) => {
                const on = angles.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setAngles((prev) => toggle(prev, a))}
                    className="grid min-h-12 hover:bg-panel w-full cursor-pointer grid-cols-[24px_120px_1fr] items-center border-0 border-b border-line bg-transparent px-1 text-left"
                  >
                    <Tick on={on} />
                    <span className={`text-[14px] ${on ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                      {ANGLE_LABELS[a]}
                    </span>
                    <span className="text-[13px] text-muted">{ANGLE_HINTS[a]}</span>
                  </button>
                );
              })}
            </div>
          </BriefRow>

          <BriefRow n={4} label="Reference, optional">
            {reference ? (
              <div className="grid max-w-[720px] grid-cols-[1fr_auto] items-center gap-3 border-y border-rule py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink">{referenceLabel(reference)}</div>
                  <div className="font-mono text-[12px] text-muted">{referenceStructure(reference)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setReference(null)}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex max-w-[720px] flex-col gap-2 sm:flex-row sm:items-center">
                {myReferences.length > 0 ? (
                  <select
                    aria-label="Pick one of your references"
                    value=""
                    onChange={(e) => setReference(myReferences.find((r) => r.id === e.target.value) ?? null)}
                    className={`${inputClasses} sm:max-w-[320px]`}
                  >
                    <option value="">Pick one of yours</option>
                    {myReferences.map((r) => (
                      <option key={r.id} value={r.id}>
                        {referenceLabel(r)}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Link href="/discover" className="text-[13px] font-semibold text-ink underline underline-offset-4">
                  Find one in Discover
                </Link>
              </div>
            )}
            {referenceError ? <p className="margin-note m-0 mt-2">{referenceError}</p> : null}
          </BriefRow>

          <div className="grid grid-cols-1 items-center gap-4 border-b border-rule py-5 md:grid-cols-[200px_1fr_auto] md:gap-8">
            <p className="kicker m-0 text-ink">This batch</p>
            <p className="font-display m-0 text-[22px] sm:text-[26px]">
              {count === 0 ? (
                <span className="text-muted">Tick at least one placement and one angle.</span>
              ) : (
                <>
                  {count} {count === 1 ? "ad" : "ads"}
                  <span className="font-mono text-[13px] font-normal tracking-normal text-muted">
                    {"  "}
                    {angles.length} {angles.length === 1 ? "angle" : "angles"} × {placements.length}{" "}
                    {placements.length === 1 ? "placement" : "placements"} / {cost} {cost === 1 ? "credit" : "credits"}
                  </span>
                </>
              )}
            </p>
            <Button onClick={() => void generate()} disabled={!generationAvailable || !productId || count === 0 || generating}>
              {generating ? "Starting…" : count > 0 ? `Make and check ${count}` : "Make and check"}
            </Button>
          </div>
        </section>
      ) : null}

      {!showBrief && selected ? (
        <>
          <ProofDesk
            key={`${selected.id}:${selected.compositeUrl ?? ""}`}
            creative={selected}
            onRegenerate={() => void regenerate(selected)}
            onFix={(action) => void fix(selected, action)}
            fixing={fixingId === selected.id}
            regenerating={generating}
            regenerateDisabled={!generationAvailable}
            creditsPerVariant={creditsPerVariant}
          />

          <section aria-label="Contact sheet" className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule pb-2">
              <h2 className="kicker m-0 text-ink">Contact sheet</h2>
              <p className="m-0 font-mono text-[12px] text-muted" aria-live="polite">
                {sheet.length} {sheet.length === 1 ? "ad" : "ads"}
                {tally.cleared ? <span className="text-pass"> / {tally.cleared} cleared</span> : null}
                {tally.fix ? <span className="text-mark"> / {tally.fix} to fix</span> : null}
                {tally.blocked ? <span className="text-mark"> / {tally.blocked} blocked</span> : null}
                {tally.checking ? <span className="text-guide"> / {tally.checking} in progress</span> : null}
              </p>
            </div>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-min items-start gap-x-3 gap-y-4 pt-4"
                style={{ gridTemplateColumns: `88px repeat(${cols.length}, minmax(104px, 148px))` }}
              >
                <span />
                {cols.map((p) => (
                  <span key={p} className="kicker px-1">
                    {PLACEMENT_LABELS[p]}
                  </span>
                ))}
                {rows.map((a) => (
                  <div key={a} className="contents">
                    <span className="self-start pt-2 text-[13px] font-semibold">{ANGLE_LABELS[a]}</span>
                    {cols.map((p) => {
                      const cell = sheet.find((c) => c.angle === a && c.placement === p);
                      return cell ? (
                        <ProofTile
                          key={cell.id}
                          creative={cell}
                          selected={cell.id === selected.id}
                          onSelect={() => setSelectedId(cell.id)}
                        />
                      ) : (
                        <span
                          key={`${a}-${p}`}
                          aria-label="Not in this batch"
                          className="hatch m-1 block self-stretch border border-line"
                          style={{ aspectRatio: PLACEMENT_RATIO[p] }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="m-0 mt-5 text-[13px] text-muted">
              Earlier batches are in{" "}
              <Link href="/creatives" className="font-semibold text-ink underline underline-offset-4">
                Creatives
              </Link>
              .
            </p>
          </section>
        </>
      ) : null}

      {showBrief && sheet.length === 0 ? (
        <section aria-label="What you get" className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
          <p className="kicker m-0 text-ink">What comes back</p>
          <div className="max-w-[720px]">
            <ol className="m-0 list-none border-t border-rule p-0 text-[14px] text-ink-2">
              <li className="border-b border-line py-2">
                <span className="font-mono text-mark">1 </span>Anything that must change is numbered in red, with a note
                saying why.
              </li>
              <li className="border-b border-line py-2">
                <span className="font-mono text-guide">2 </span>The placement&apos;s safe zone is ruled in blue.
              </li>
              <li className="border-b border-line py-2">
                <span className="font-mono text-pass">3 </span>Cleared ads carry a tag for the ad name, so Results can
                match spend to them.
              </li>
            </ol>
          </div>
        </section>
      ) : null}
    </div>
  );
}
