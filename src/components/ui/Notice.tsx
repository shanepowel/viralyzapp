import type { ReactNode } from "react";

/**
 * An inline message. Chrome stays monochrome: only the glyph carries the
 * fail colour for errors, and "info" is plain.
 */
export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "error";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-inner border border-line bg-panel px-3.5 py-2.5 text-[13px] text-ink ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-[1px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          tone === "error" ? "bg-fail-bg text-fail" : "bg-card text-muted border border-line"
        }`}
      >
        {tone === "error" ? "!" : "i"}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
