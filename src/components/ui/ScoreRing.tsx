"use client";

import { ringDashOffset, scoreColor } from "@/lib/score-bands";

type Props = {
  score: number;
  size?: "sm" | "lg";
};

export function ScoreRing({ score, size = "sm" }: Props) {
  if (size === "lg") {
    const r = 64;
    const c = 2 * Math.PI * r;
    const color = scoreColor(score);
    return (
      <div className="relative w-[150px] h-[150px]">
        <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="75" cy="75" r={r} fill="none" stroke="#F1EFEA" strokeWidth="10" />
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={ringDashOffset(score, c)}
            style={{ transition: "stroke-dashoffset 0.45s cubic-bezier(0.16,1,0.3,1), stroke 0.35s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="score-ring-num font-display text-[44px] font-bold leading-none"
            style={{ color }}
          >
            {score}
          </span>
          <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--ink-3)] mt-1">
            Viral Score
          </span>
        </div>
      </div>
    );
  }

  const r = 13.5;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative w-[34px] h-[34px]">
      <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="17" cy="17" r={r} fill="none" stroke="#F1EFEA" strokeWidth="3.5" />
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={ringDashOffset(score, c)}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono text-[10.5px] font-semibold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
