import type { ReactNode } from "react";

type Props = {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  /** "card" sits on the page under a heavy rule; "panel" is a white sheet with a hairline frame. */
  tone?: "card" | "panel";
};

/**
 * A section, not a card: a 1px ink rule across the top, the title in mono
 * caps under it, and the content on the page itself. tone="panel" is for the
 * few places that need a framed white sheet (forms, dialogs).
 */
export function Panel({ title, meta, children, className = "", tone = "card" }: Props) {
  const frame = tone === "panel" ? "border border-rule bg-card" : "border-t border-rule";
  return (
    <section className={`${frame} ${className}`}>
      {(title || meta) && (
        <div className={`flex items-center justify-between gap-3 border-b border-line py-2.5 ${tone === "panel" ? "px-4" : ""}`}>
          {title ? <h2 className="kicker m-0 text-ink">{title}</h2> : <span />}
          {meta}
        </div>
      )}
      {children}
    </section>
  );
}
