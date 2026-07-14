"use client";

import { Button } from "@/components/ui/Button";
import { railColor } from "@/lib/score-bands";

type Props = {
  title: string;
  description: string;
  suggestionText: string;
  pointValue: number;
  railSeverity: string;
  applied: boolean;
  pointsEarned: number | null;
  onApply?: () => void;
  onSkip?: () => void;
  busy?: boolean;
};

export function FixCard({
  title,
  description,
  suggestionText,
  pointValue,
  railSeverity,
  applied,
  pointsEarned,
  onApply,
  onSkip,
  busy,
}: Props) {
  return (
    <div
      className="flex gap-4 px-5 py-[18px] border-b border-[var(--line)] items-start last:border-b-0"
      style={{ background: applied ? "var(--s90-soft)" : "transparent" }}
    >
      <div
        className="w-1 rounded-full self-stretch shrink-0"
        style={{ background: applied ? "var(--s90)" : railColor(railSeverity) }}
      />
      <div className="flex-1">
        <h4 className="text-[14px] m-0 mb-1 flex gap-2.5 items-center flex-wrap font-semibold">
          {title}{" "}
          {applied ? (
            <span className="text-[11.5px] font-bold text-[var(--s90)] inline-flex gap-1.5 items-center">
              ✓ Applied · earned +{pointsEarned ?? pointValue}
            </span>
          ) : (
            <span className="font-mono text-[11.5px] text-[var(--s90)] font-semibold">
              worth +{pointValue}
            </span>
          )}
        </h4>
        <p className="text-[13px] text-[var(--ink-2)] m-0 mb-2.5">{description}</p>
        <div
          className="rounded-[10px] px-3.5 py-2.5 text-[13px] mb-3 italic text-[var(--ink)]"
          style={{ background: applied ? "#fff" : "var(--tint)" }}
        >
          {suggestionText}
        </div>
        {!applied && (
          <div className="flex gap-2">
            <Button size="sm" onClick={onApply} disabled={busy}>
              {busy ? "Scoring…" : "Apply and score again"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onSkip} disabled={busy}>
              Skip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
