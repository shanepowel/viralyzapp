import type { ReactNode } from "react";

/** Shared input look: 1px ink rule, 2px corner, white sheet, blue focus ring from the base layer. */
export const inputClasses =
  "w-full min-h-11 rounded-inner border border-rule bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted disabled:opacity-50";

/** Field label: small mono caps above the input. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="kicker">{children}</span>;
}
