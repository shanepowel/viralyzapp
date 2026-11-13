import type { ReactNode } from "react";

export type CheckState = "pass" | "warn" | "fail" | "estimate" | "locked" | "running";

/*
 * A status is a word in mono caps with a small square glyph, not a coloured
 * pill. Red means something must change; "blocked" is the filled version.
 */
const STYLES: Record<CheckState, string> = {
  pass: "text-pass",
  warn: "text-mark",
  fail: "bg-mark text-bg px-1.5",
  // AI-assessed values are never coloured: they are opinions, not measurements.
  estimate: "text-muted",
  locked: "text-muted",
  running: "text-guide",
};

const WORDS: Record<CheckState, string> = {
  pass: "Cleared",
  warn: "To fix",
  fail: "Blocked",
  estimate: "Estimate",
  locked: "Not checked",
  running: "Checking",
};

function Glyph({ state }: { state: CheckState }) {
  if (state === "pass") {
    return (
      <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        <path d="M2 7.5l3.2 3.2L12 3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
    );
  }
  if (state === "warn") {
    return <span aria-hidden="true" className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-mark" />;
  }
  if (state === "fail") {
    return (
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      </svg>
    );
  }
  if (state === "estimate") return <span aria-hidden="true">~</span>;
  if (state === "locked") {
    return <span aria-hidden="true" className="inline-block h-[7px] w-[7px] shrink-0 border border-muted hatch" />;
  }
  return <span aria-hidden="true" className="inline-block h-[7px] w-[7px] shrink-0 border border-guide vz-shimmer" />;
}

/**
 * A check result. Every state shows a glyph and a word, so colour never
 * carries the meaning alone.
 */
export function CheckChip({ state, label }: { state: CheckState; label?: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-inner py-[2px] font-mono text-[11px] font-medium uppercase tracking-[0.06em] tabular ${STYLES[state]}`}
    >
      <Glyph state={state} />
      <span>{label ?? WORDS[state]}</span>
    </span>
  );
}
