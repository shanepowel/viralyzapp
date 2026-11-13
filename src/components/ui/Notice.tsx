import type { ReactNode } from "react";

/**
 * An inline message. Info is a plain ruled line; an error is written the way
 * a problem on an ad is: red, in the margin-note hand.
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
      className={`flex items-start gap-2.5 border-y py-2.5 text-[13px] ${
        tone === "error" ? "border-mark text-mark" : "border-line text-ink-2"
      } ${className}`}
    >
      <span aria-hidden="true" className="kicker shrink-0 pt-[2px]" style={tone === "error" ? { color: "var(--vz-mark)" } : undefined}>
        {tone === "error" ? "Problem" : "Note"}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
