"use client";

import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode; disabled?: boolean };

/**
 * One-of-many choice drawn as joined rectangles under a single ink rule.
 * Replaces the pill filters and pill choices used before the redesign.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "min-h-8 px-2.5 text-[12px]" : "min-h-10 px-3.5 text-[13px]";
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex max-w-full flex-wrap border border-rule ${className}`}>
      {options.map((opt, i) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer border-0 font-medium disabled:cursor-not-allowed disabled:opacity-40 ${pad} ${
              i > 0 ? "border-l border-rule" : ""
            } ${checked ? "bg-ink text-bg" : "bg-transparent text-ink hover:bg-panel"}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
