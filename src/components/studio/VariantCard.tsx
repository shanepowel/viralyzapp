"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckChip, type CheckState } from "@/components/ui/CheckChip";
import { PreflightBadge } from "@/components/ui/PreflightBadge";
import { PLACEMENTS } from "@/lib/preflight/placements";
import type { Placement } from "@/lib/preflight/types";

export type FactorResultDTO = {
  id: string;
  label: string;
  kind: "computed" | "rule" | "model";
  status: "scored" | "unavailable";
  value?: number;
  passed?: boolean;
  evidence: string;
};

export type CreativeDTO = {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  referenceId?: string | null;
  status: "pending" | "generating" | "ready" | "failed";
  headline: string | null;
  primaryText?: string | null;
  cta?: string | null;
  compositeUrl: string | null;
  aiGenerated: boolean;
  createdAt?: string;
  checks: Array<{
    headline: number | null;
    headlineBasis: { counted: number; total: number };
    factors: FactorResultDTO[];
  }>;
};

export const PLACEMENT_LABELS: Record<string, string> = {
  meta_feed_1x1: "Meta feed 1:1",
  meta_feed_4x5: "Meta feed 4:5",
  story_9x16: "Story 9:16",
  tiktok_9x16: "TikTok 9:16",
};

/** CSS aspect-ratio per placement, so the preview has the shape the ad will have. */
const PLACEMENT_RATIO: Record<string, string> = {
  meta_feed_1x1: "1 / 1",
  meta_feed_4x5: "4 / 5",
  story_9x16: "9 / 16",
  tiktok_9x16: "9 / 16",
};

function safeZonePct(placement: string): { top: number; right: number; bottom: number; left: number } | null {
  const spec = PLACEMENTS[placement as Placement["id"]];
  if (!spec) return null;
  const { safeZone, width, height } = spec;
  if (safeZone.top + safeZone.right + safeZone.bottom + safeZone.left === 0) return null;
  return {
    top: (safeZone.top / height) * 100,
    right: (safeZone.right / width) * 100,
    bottom: (safeZone.bottom / height) * 100,
    left: (safeZone.left / width) * 100,
  };
}

const ANGLE_LABELS: Record<string, string> = {
  offer: "Offer",
  problem: "Problem",
  proof: "Proof",
  demo: "Demo",
};

/** AI-assessed factors never pass or fail in the UI: they show a grey estimate, as the marketing site promises. */
function factorState(factor: FactorResultDTO): { state: CheckState; label?: string } {
  if (factor.status === "unavailable") return { state: "locked" };
  if (factor.kind === "model") {
    return { state: "estimate", label: factor.value != null ? `${factor.value} · estimate` : "estimate" };
  }
  return { state: factor.passed ? "pass" : "fail" };
}

function FactorRow({ factor }: { factor: FactorResultDTO }) {
  const { state, label } = factorState(factor);
  return (
    <li className="py-2 border-t border-line first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ink">{factor.label.replace(/ \(AI-assessed\)$/, "")}</span>
        <CheckChip state={state} label={label} />
      </div>
      <p className="m-0 mt-0.5 text-[12px] text-muted">{factor.evidence}</p>
    </li>
  );
}

function CopyLine({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the text is on screen to copy by hand.
    }
  }
  return (
    <div className="group flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-muted">{label}</div>
        <div className="text-[13px] text-ink break-words">{text}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 rounded-full border border-line bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted cursor-pointer hover:text-ink"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function VariantCard({
  creative,
  onRegenerate,
  regenerating,
  regenerateDisabled,
}: {
  creative: CreativeDTO;
  onRegenerate: () => void;
  regenerating?: boolean;
  /** True when generation is unavailable, so a click could never succeed. */
  regenerateDisabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const latestCheck = creative.checks[0];
  const busy = creative.status === "pending" || creative.status === "generating";
  const safeZone = safeZonePct(creative.placement);
  const scored = latestCheck?.factors.filter((f) => f.status === "scored" && f.kind !== "model") ?? [];
  const passed = scored.filter((f) => f.passed).length;

  async function copyTag() {
    try {
      await navigator.clipboard.writeText(creative.tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) — the
      // tag is still visible on the card to copy by hand.
    }
  }

  return (
    <article className="bg-card border border-line rounded-card overflow-hidden flex flex-col">
      <div className="bg-panel dots p-4">
        <div
          className={`relative w-full rounded-inner overflow-hidden border border-line bg-card ${
            busy ? "vz-shimmer" : ""
          }`}
          style={{ aspectRatio: PLACEMENT_RATIO[creative.placement] ?? "1 / 1" }}
        >
          {creative.compositeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.compositeUrl}
              alt={creative.headline ?? "Generated ad"}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
              {creative.status === "failed" ? (
                <span className="text-[12px] text-muted">Generation failed. Any reserved credit was returned.</span>
              ) : (
                <span className="text-[12px] text-muted">
                  {creative.status === "pending" ? "Queued…" : busy ? "Generating…" : "No image stored"}
                </span>
              )}
            </div>
          )}
          {safeZone ? (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-white/90 bg-black/35"
                style={{ height: `${safeZone.top}%` }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-white/90 bg-black/35"
                style={{ height: `${safeZone.bottom}%` }}
              />
              <div
                className="pointer-events-none absolute left-0 border-r border-dashed border-white/90 bg-black/35"
                style={{ top: `${safeZone.top}%`, bottom: `${safeZone.bottom}%`, width: `${safeZone.left}%` }}
              />
              <div
                className="pointer-events-none absolute right-0 border-l border-dashed border-white/90 bg-black/35"
                style={{ top: `${safeZone.top}%`, bottom: `${safeZone.bottom}%`, width: `${safeZone.right}%` }}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-muted">
            {PLACEMENT_LABELS[creative.placement] ?? creative.placement} ·{" "}
            {ANGLE_LABELS[creative.angle] ?? creative.angle}
          </span>
          {creative.tag ? (
            <button
              type="button"
              onClick={() => void copyTag()}
              title="Copy the tracking tag"
              className="text-[12px] font-semibold text-ink bg-panel rounded-full px-2.5 py-0.5 border-none cursor-pointer tabular"
            >
              {copied ? "Copied" : creative.tag}
            </button>
          ) : null}
        </div>

        {creative.tag ? (
          <p className="m-0 text-[12px] leading-snug text-muted">
            Put this <span className="font-semibold text-ink">vz_</span> tag in the ad name. Results only matches a
            row when the ad name contains it.
          </p>
        ) : null}

        {latestCheck ? (
          <div className="flex flex-wrap items-center gap-2">
            <PreflightBadge
              headline={latestCheck.headline}
              counted={latestCheck.headlineBasis.counted}
              total={latestCheck.headlineBasis.total}
            />
            {scored.length > 0 ? (
              <span className="text-[12px] text-muted tabular">
                {passed} of {scored.length} passed
              </span>
            ) : null}
          </div>
        ) : busy ? (
          <CheckChip state="running" />
        ) : null}

        {creative.headline || creative.primaryText || creative.cta ? (
          <div className="flex flex-col gap-2.5 rounded-inner bg-panel p-3">
            {creative.headline ? <CopyLine label="Headline" text={creative.headline} /> : null}
            {creative.primaryText ? <CopyLine label="Primary text" text={creative.primaryText} /> : null}
            {creative.cta ? <CopyLine label="Call to action" text={creative.cta} /> : null}
          </div>
        ) : null}

        {latestCheck && latestCheck.factors.length > 0 ? (
          <div>
            <button
              type="button"
              aria-expanded={showChecks}
              onClick={() => setShowChecks((v) => !v)}
              className="w-full flex items-center justify-between rounded-full border border-line bg-card px-3.5 min-h-9 text-[13px] font-semibold text-ink cursor-pointer"
            >
              <span>Pre-flight checks</span>
              <span className="text-muted" aria-hidden="true">
                {showChecks ? "−" : "+"}
              </span>
            </button>
            {showChecks ? (
              <ul className="m-0 mt-2 p-0 list-none">
                {latestCheck.factors.map((factor) => (
                  <FactorRow key={factor.id} factor={factor} />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {creative.aiGenerated ? (
          <p className="m-0 text-[11.5px] text-muted">AI-generated. Disclose this per your ad platform&apos;s policy.</p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {creative.compositeUrl ? (
            <a
              href={`/api/studio/creatives/${creative.id}/download`}
              className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-full bg-btn px-3.5 text-[13px] font-semibold text-btn-ink"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download
            </a>
          ) : null}
          {creative.status === "failed" || creative.status === "ready" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={regenerating || regenerateDisabled}
            >
              {regenerating ? "Regenerating…" : creative.status === "failed" ? "Retry" : "Regenerate"}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
