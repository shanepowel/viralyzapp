import type { ReactNode } from "react";

type Props = {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

export function Panel({ title, meta, children, className = "", noPadding }: Props) {
  return (
    <div
      className={`bg-[var(--card)] border border-[var(--line)] rounded-[14px] ${className}`}
    >
      {(title || meta) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          {title ? <h3 className="text-[15px] m-0 font-semibold">{title}</h3> : <span />}
          {meta}
        </div>
      )}
      <div className={noPadding ? "" : ""}>{children}</div>
    </div>
  );
}
