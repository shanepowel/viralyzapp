"use client";

import { useState } from "react";
import { AdProof } from "@/components/studio/AdProof";
import {
  ANGLE_LABELS,
  PLACEMENT_LABELS,
  cleanLabel,
  placementPixels,
  readProof,
  safeZonePct,
  type CreativeDTO,
  type FactorResultDTO,
} from "@/components/studio/proof";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";

type View = "feed" | "artboard";

function useCopied(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the text is on screen to copy by hand.
    }
  }
  return [copied, copy];
}

function CopyLine({ label, text, limit }: { label: string; text: string; limit?: string }) {
  const [copied, copy] = useCopied();
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-line py-2.5">
      <div className="min-w-0">
        <div className="kicker">
          {label}
          <span className="ml-2 normal-case tracking-normal">
            {text.length} characters{limit ? ` ${limit}` : ""}
          </span>
        </div>
        <div className="mt-0.5 break-words text-[14px] text-ink">{text}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy(text)}
        className="min-h-8 cursor-pointer border-0 bg-transparent font-mono text-[11px] uppercase tracking-[0.06em] text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function ClearedRow({ factor }: { factor: FactorResultDTO }) {
  return (
    <li className="grid grid-cols-[16px_1fr] gap-2 border-b border-line py-2">
      <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" className="mt-[3px] text-pass">
        <path d="M2 7.5l3.2 3.2L12 3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
      <div className="min-w-0">
        <span className="text-[13px] font-medium text-ink">{cleanLabel(factor)}</span>
        <span className="ml-2 text-[12px] text-muted">{factor.evidence}</span>
      </div>
    </li>
  );
}

/**
 * The review desk for one ad: the proof on the left, the margin on the
 * right. Anything that must change is a numbered red mark with a note to
 * the seller; what passed is listed quietly below it.
 */
export function ProofDesk({
  creative,
  onRegenerate,
  regenerating = false,
  regenerateDisabled = false,
  creditsPerVariant,
}: {
  creative: CreativeDTO;
  onRegenerate: () => void;
  regenerating?: boolean;
  /** True when generation is unavailable, so a click could never succeed. */
  regenerateDisabled?: boolean;
  creditsPerVariant?: number;
}) {
  const [view, setView] = useState<View>("feed");
  const [tagCopied, copyTag] = useCopied();
  const proof = readProof(creative);
  const pixels = placementPixels(creative.placement);
  const hasZone = safeZonePct(creative.placement) !== null;
  const tall = creative.placement.endsWith("9x16");
  const blocked = proof.verdict === "blocked";
  const canRegenerate = creative.status === "ready" || creative.status === "failed";
  const cost =
    creditsPerVariant != null ? `, ${creditsPerVariant} credit${creditsPerVariant === 1 ? "" : "s"}` : "";

  let verdict: { text: string; tone: string; sub: string };
  switch (proof.verdict) {
    case "checking":
      verdict = {
        text: creative.status === "pending" ? "In the queue." : "Being made and checked.",
        tone: "text-guide",
        sub: "The checks run the moment the image exists. Nothing to do yet.",
      };
      break;
    case "failed":
      verdict = {
        text: "This one was not made.",
        tone: "text-ink",
        sub: "The credit reserved for it was returned. Make it again when you are ready.",
      };
      break;
    case "blocked":
      verdict = {
        text: "Blocked by a policy rule.",
        tone: "text-mark",
        sub: "The wording breaks a platform advertising rule, so the download is held back.",
      };
      break;
    case "fix":
      verdict = {
        text: `${proof.marks.length} ${proof.marks.length === 1 ? "mark" : "marks"} to clear.`,
        tone: "text-mark",
        sub: "You can still download it. The marks say what an ad platform or a viewer would trip on.",
      };
      break;
    case "cleared":
      verdict = {
        text: "Cleared.",
        tone: "text-pass",
        sub: `All ${proof.cleared.length} measured checks passed for this placement.`,
      };
      break;
    default:
      verdict = { text: "Not checked.", tone: "text-ink", sub: "No measured checks have run on this ad yet." };
  }

  return (
    <article className="border-y border-rule">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-2.5">
        <p className="kicker m-0 text-ink">
          {ANGLE_LABELS[creative.angle] ?? creative.angle}
          <span className="text-muted"> / {PLACEMENT_LABELS[creative.placement] ?? creative.placement}</span>
          {pixels ? <span className="text-muted"> / {pixels} px</span> : null}
        </p>
        <Segmented
          label="How to view the ad"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "feed", label: "As people see it" },
            { value: "artboard", label: "Artboard" },
          ]}
        />
      </header>

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className={`flex justify-center ${view === "artboard" ? "bg-panel p-6" : ""}`}>
          <div className={`w-full ${tall ? "max-w-[340px]" : "max-w-[520px]"}`}>
            <AdProof creative={creative} guides={view === "artboard"} />
            {view === "artboard" ? (
              <p className="m-0 mt-2 font-mono text-[11px] text-muted">
                {pixels ? `${pixels} px. ` : ""}
                {hasZone
                  ? "Blue is the platform's safe zone: keep text and the logo inside it."
                  : "Feed placements have no overlay, so there is no safe zone to keep clear."}
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0" aria-live="polite">
          <h2 className={`font-display m-0 text-[28px] ${verdict.tone}`}>{verdict.text}</h2>
          <p className="m-0 mt-2 text-[13px] text-ink-2">{verdict.sub}</p>

          {proof.marks.length > 0 ? (
            <ol className="m-0 mt-5 list-none border-t border-mark p-0">
              {proof.marks.map((mark) => (
                <li key={mark.factor.id} className="grid grid-cols-[28px_1fr] gap-2 border-b border-line py-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-mark font-mono text-[11px] font-medium text-mark"
                  >
                    {mark.n}
                  </span>
                  <div className="min-w-0">
                    <p className="kicker m-0">
                      {mark.rule.no > 0 ? `Rule ${mark.rule.no} / ` : ""}
                      {mark.rule.name}
                      {mark.blocking ? <span className="ml-2 bg-mark px-1 text-bg">Blocks download</span> : null}
                    </p>
                    <p className="m-0 mt-0.5 text-[14px] font-semibold text-ink">{cleanLabel(mark.factor)}</p>
                    <p className="margin-note m-0 mt-1">{mark.factor.evidence}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {proof.cleared.length > 0 ? (
            <div className="mt-5">
              <p className="kicker m-0 border-b border-rule pb-2 text-ink">Passed</p>
              <ul className="m-0 list-none p-0">
                {proof.cleared.map((f) => (
                  <ClearedRow key={f.id} factor={f} />
                ))}
              </ul>
            </div>
          ) : null}

          {proof.estimates.length > 0 || proof.notChecked.length > 0 ? (
            <div className="mt-5">
              <p className="kicker m-0 border-b border-rule pb-2 text-ink">Not measured</p>
              <ul className="m-0 list-none p-0">
                {proof.estimates.map((f) => (
                  <li key={f.id} className="border-b border-line py-2 text-[13px] text-muted">
                    <span className="font-medium text-ink-2">{cleanLabel(f)}</span>
                    <span className="ml-2 font-mono text-[12px]">{f.value != null ? `~${f.value}` : "~"} estimate</span>
                    <span className="mt-0.5 block text-[12px]">An AI opinion, not a rule. {f.evidence}</span>
                  </li>
                ))}
                {proof.notChecked.map((f) => (
                  <li key={f.id} className="border-b border-line py-2 text-[13px] text-muted">
                    <span className="font-medium text-ink-2">{cleanLabel(f)}</span>
                    <span className="ml-2 font-mono text-[12px]">not checked</span>
                    <span className="mt-0.5 block text-[12px]">{f.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {creative.headline || creative.primaryText || creative.cta ? (
            <div className="mt-5">
              <p className="kicker m-0 border-b border-rule pb-2 text-ink">Copy</p>
              {creative.headline ? <CopyLine label="Headline" text={creative.headline} /> : null}
              {creative.primaryText ? <CopyLine label="Primary text" text={creative.primaryText} /> : null}
              {creative.cta ? <CopyLine label="Call to action" text={creative.cta} /> : null}
            </div>
          ) : null}

          {creative.tag ? (
            <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-3 border-y border-rule py-2.5">
              <p className="m-0 text-[12.5px] text-ink-2">
                Put <span className="font-mono font-medium text-ink">{creative.tag}</span> in the ad name. Results can
                only match spend to this ad when the name contains it.
              </p>
              <Button size="sm" variant="outline" onClick={() => void copyTag(creative.tag)}>
                {tagCopied ? "Copied" : "Copy tag"}
              </Button>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {creative.compositeUrl && !blocked ? (
              <a href={`/api/studio/creatives/${creative.id}/download`} className={buttonClasses("primary")}>
                Download PNG
              </a>
            ) : null}
            {creative.compositeUrl && blocked ? (
              <Button disabled aria-describedby={`blocked-${creative.id}`}>
                Download held
              </Button>
            ) : null}
            {canRegenerate ? (
              <Button
                variant={proof.marks.length > 0 || creative.status === "failed" ? "mark" : "outline"}
                onClick={onRegenerate}
                disabled={regenerating || regenerateDisabled}
              >
                {regenerating ? "Making…" : `Make it again${cost}`}
              </Button>
            ) : null}
          </div>
          {blocked ? (
            <p id={`blocked-${creative.id}`} className="margin-note m-0 mt-2">
              Make it again to get wording that clears the rule.
            </p>
          ) : null}
          {creative.aiGenerated ? (
            <p className="m-0 mt-3 text-[12px] text-muted">
              AI-generated. Disclose this where your ad platform&apos;s policy asks you to.
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
