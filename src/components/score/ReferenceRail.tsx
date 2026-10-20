import Link from "next/link";
import { ScoreRing } from "@/components/ui/ScoreRing";

export type ReferenceItem = {
  id: string;
  title: string;
  score: number;
};

export function ReferenceRail({ items }: { items: ReferenceItem[] }) {
  return (
    <aside className="w-full lg:w-[260px] shrink-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-3">
        Your scored content
      </div>
      {items.length === 0 ? (
        <div className="rounded-[14px] border border-[var(--line)] bg-[var(--card)] p-4 text-[13px] text-[var(--ink-2)]">
          Nothing scored yet. Your past scores will show up here for comparison.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/content/${item.id}`}
              className="flex items-center gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--card)] p-3 no-underline hover:border-[var(--line-strong)]"
            >
              <ScoreRing score={item.score} />
              <span className="flex-1 text-[13px] font-medium text-[var(--ink)] truncate">
                {item.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
