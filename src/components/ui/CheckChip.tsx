import type { ReactNode } from "react";

export type CheckState = "pass" | "warn" | "fail" | "estimate" | "locked" | "running";

const STYLES: Record<CheckState, string> = {
  pass: "bg-pass-bg text-pass",
  warn: "bg-warn-bg text-warn",
  fail: "bg-fail-bg text-fail",
  // AI-assessed values are always neutral grey.
  estimate: "border border-line text-muted",
  locked: "border border-dashed border-line text-muted",
  running: "vz-shimmer border border-line text-muted",
};

const WORDS: Record<CheckState, string> = {
  pass: "Passed",
  warn: "Warning",
  fail: "Failed",
  estimate: "estimate",
  locked: "Not checked",
  running: "Checking",
};

function Glyph({ state }: { state: CheckState }) {
  if (state === "pass") {
    return (
      <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        <path
          d="M2.5 7.5l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "warn") return <span aria-hidden="true">!</span>;
  if (state === "fail") return <span aria-hidden="true">✕</span>;
  return null;
}

/**
 * A pre-flight check result, as on the marketing site. Every state shows a
 * glyph and a word, so colour never carries the meaning alone.
 */
export function CheckChip({ state, label }: { state: CheckState; label?: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[9px] py-[3px] text-[12px] font-semibold tabular ${STYLES[state]}`}
    >
      <Glyph state={state} />
      <span>{label ?? WORDS[state]}</span>
    </span>
  );
}
