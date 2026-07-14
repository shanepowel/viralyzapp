import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function StickyActionBar({ children }: Props) {
  return (
    <div
      className="sticky bottom-0 border-t border-[var(--line)] py-3.5 flex gap-2.5 justify-end z-20"
      style={{
        background: "rgba(250,250,247,0.9)",
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </div>
  );
}
