import type { ReactNode } from "react";

/** Shared input look: hairline border, 12px radius, ink focus ring. */
export const inputClasses =
  "w-full min-h-11 rounded-inner border border-line bg-card px-3.5 py-2 text-[14px] text-ink outline-none transition-[border-color] duration-[var(--vz-dur-fast)] focus:border-ink";

/** Small field label above an input. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[12px] font-semibold text-muted">{children}</span>;
}
