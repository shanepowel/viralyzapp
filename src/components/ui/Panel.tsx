import type { ReactNode } from "react";

type Props = {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  /** "card" is the white surface; "panel" is the tinted surface used for groups. */
  tone?: "card" | "panel";
};

export function Panel({ title, meta, children, className = "", tone = "card" }: Props) {
  return (
    <div
      className={`${tone === "panel" ? "bg-panel" : "bg-card"} border border-line rounded-card ${className}`}
    >
      {(title || meta) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          {title ? <h2 className="text-[15px] m-0 font-semibold">{title}</h2> : <span />}
          {meta}
        </div>
      )}
      {children}
    </div>
  );
}
