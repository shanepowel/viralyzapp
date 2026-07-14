import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string | number;
  delta?: number;
  footnote?: ReactNode;
  sparkline?: number[];
  className?: string;
};

export function StatCard({ label, value, delta, footnote, sparkline, className = "" }: Props) {
  const max = sparkline ? Math.max(...sparkline, 1) : 1;
  return (
    <div
      className={`bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-5 relative ${className}`}
    >
      <div className="text-[12px] text-[var(--ink-3)] font-medium mb-2.5">{label}</div>
      <div className="font-display text-[32px] font-bold leading-none flex items-baseline gap-2.5">
        {value}
        {delta != null && (
          <span
            className="font-mono text-[11.5px] font-medium"
            style={{ color: delta >= 0 ? "var(--s90)" : "var(--s30)" }}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
          </span>
        )}
      </div>
      {footnote && (
        <div className="text-[11.5px] text-[var(--ink-3)] mt-2">{footnote}</div>
      )}
      {sparkline && (
        <div className="absolute right-[18px] bottom-5 flex items-end gap-[3px] h-[26px]">
          {sparkline.map((v, i) => (
            <i
              key={i}
              className="w-[5px] rounded-[2px] block"
              style={{
                height: `${Math.max(6, (v / max) * 26)}px`,
                background: i === sparkline.length - 1 ? "var(--violet)" : "var(--violet-soft)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
