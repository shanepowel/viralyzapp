"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type Mode = "week" | "month" | "list";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function itemDate(item: Item): Date | null {
  const raw = item.scheduledFor || item.postedAt;
  return raw ? new Date(raw) : null;
}

export function CalendarView({ items }: { items: Item[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function schedule(id: string, when?: Date) {
    setBusyId(id);
    setError(null);
    try {
      const scheduledFor = when ?? (() => {
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        return d;
      })();
      const res = await fetch(`/api/content/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: scheduledFor.toISOString() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not schedule");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule");
    } finally {
      setBusyId(null);
    }
  }

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    if (mode === "month") {
      const start = startOfMonth(anchor);
      const first = startOfWeek(start);
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(first);
        d.setDate(first.getDate() + i);
        return d;
      });
    }
    return [];
  }, [mode, anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const d = itemDate(item);
      if (!d) continue;
      const key = d.toDateString();
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const unscheduled = items.filter((i) => !i.scheduledFor && !i.postedAt && i.status === "draft");

  function shift(dir: -1 | 1) {
    const next = new Date(anchor);
    if (mode === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  const heading =
    mode === "month"
      ? anchor.toLocaleString(undefined, { month: "long", year: "numeric" })
      : mode === "week"
        ? `Week of ${startOfWeek(anchor).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : "All scheduled content";

  return (
    <div className="vfade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-[22px] pb-6">
        <div>
          <h1 className="font-display text-2xl font-bold m-0">Calendar</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            Week and month of your scheduled and posted content. Click a draft day slot to schedule.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["week", "month", "list"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold border cursor-pointer ${
                mode === m
                  ? "bg-[var(--violet-soft)] text-[var(--violet-deep)] border-[var(--violet)]"
                  : "bg-[var(--card)] text-[var(--ink-2)] border-[var(--line-strong)]"
              }`}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
          {error}
        </div>
      )}

      {mode !== "list" && (
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>
            Prev
          </Button>
          <div className="font-display font-semibold text-[15px]">{heading}</div>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>
            Next
          </Button>
        </div>
      )}

      {mode !== "list" ? (
        <div
          className={`grid gap-2 ${mode === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-2 sm:grid-cols-7"}`}
        >
          {days.map((day) => {
            const key = day.toDateString();
            const dayItems = byDay.get(key) ?? [];
            const inMonth = day.getMonth() === anchor.getMonth();
            return (
              <div
                key={key}
                className={`rounded-[14px] border border-[var(--line)] bg-[var(--card)] p-3 min-h-[110px] ${
                  mode === "month" && !inMonth ? "opacity-45" : ""
                } ${sameDay(day, new Date()) ? "ring-2 ring-[var(--violet-soft)]" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/content-id");
                  if (id) {
                    const target = new Date(day);
                    target.setHours(18, 0, 0, 0);
                    void schedule(id, target);
                  }
                }}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-2">
                  {day.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="flex flex-col gap-1.5">
                  {dayItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/content/${item.id}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/content-id", item.id)}
                      className="rounded-[10px] bg-[var(--tint)] px-2 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--violet-soft)]"
                    >
                      {item.title}
                      {item.score != null ? (
                        <span className="font-mono text-[10px] text-[var(--ink-3)] ml-1">
                          {item.score}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                  {dayItems.length === 0 && unscheduled[0] && (
                    <button
                      type="button"
                      className="text-[11px] text-[var(--violet-deep)] font-semibold bg-transparent border-none cursor-pointer text-left p-0"
                      disabled={busyId === unscheduled[0].id}
                      onClick={() => {
                        const target = new Date(day);
                        target.setHours(18, 0, 0, 0);
                        void schedule(unscheduled[0].id, target);
                      }}
                    >
                      + Schedule draft here
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3">
          {[...items]
            .sort((a, b) => {
              const at = a.scheduledFor || a.postedAt || "";
              const bt = b.scheduledFor || b.postedAt || "";
              return at.localeCompare(bt);
            })
            .map((item) => {
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
                        <Button
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void schedule(item.id)}
                        >
                          Schedule 6pm
                        </Button>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
        </div>
      )}

      {unscheduled.length > 0 && mode !== "list" && (
        <Panel title="Unscheduled drafts" className="mt-5">
          <div className="px-5 py-4 flex flex-col gap-2">
            <p className="text-[12px] text-[var(--ink-3)] m-0">
              Drag a draft onto a day, or use “Schedule draft here”.
            </p>
            {unscheduled.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/content-id", item.id)}
                className="rounded-[10px] border border-[var(--line)] px-3 py-2 text-[13px] font-semibold cursor-grab bg-[var(--card)]"
              >
                {item.title}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {items.length === 0 && (
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
  );
}
