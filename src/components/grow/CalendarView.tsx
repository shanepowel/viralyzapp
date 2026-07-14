"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";

type Item = {
  id: string;
  title: string;
  status: string;
  score: number | null;
  scheduledFor: string | null;
  postedAt: string | null;
};

export function CalendarView({ items }: { items: Item[] }) {
  const router = useRouter();

  async function schedule(id: string) {
    await fetch(`/api/content/${id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    router.refresh();
  }

  const sorted = [...items].sort((a, b) => {
    const at = a.scheduledFor || a.postedAt || "";
    const bt = b.scheduledFor || b.postedAt || "";
    return at.localeCompare(bt);
  });

  return (
    <div className="vfade">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Calendar</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Best posting times from your drafts, scheduled, and posted content.
        </p>
      </div>
      <div className="grid gap-3">
        {sorted.map((item) => {
          const when = item.scheduledFor || item.postedAt;
          const label = when
            ? new Date(when).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Unscheduled";
          return (
            <Panel key={item.id}>
              <div className="p-4 flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <div className="font-mono text-[11px] text-[var(--ink-3)] mb-1">{label}</div>
                  <Link
                    href={`/content/${item.id}`}
                    className="font-semibold text-[14px] text-[var(--ink)]"
                  >
                    {item.title}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  {item.score != null && <ScoreRing score={item.score} />}
                  <Chip status={item.status} />
                  {item.status === "draft" && (
                    <Button size="sm" onClick={() => void schedule(item.id)}>
                      Schedule 6pm
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
        {sorted.length === 0 && (
          <Panel>
            <div className="p-6 text-[var(--ink-2)]">
              Nothing on the calendar yet.{" "}
              <Link href="/score" className="text-[var(--violet-deep)] font-semibold">
                Score content
              </Link>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
