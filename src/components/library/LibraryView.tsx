"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { formatDuration, formatViews, platformLabel } from "@/lib/score-bands";

export type LibraryItem = {
  id: string;
  title: string;
  status: string;
  durationSec: number;
  thumbnailUrl: string | null;
  platform: string | null;
  score: number | null;
  actualViews: number | null;
  predictedViewsLow: number | null;
  predictedViewsHigh: number | null;
};

type Props = { items: LibraryItem[] };

export function LibraryView({ items }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (q && !i.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, q, status]);

  return (
    <div className="vfade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-[22px] pb-6">
        <div>
          <h1 className="font-display text-2xl font-bold m-0">Library</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            All scored content — click a row for Score Results.
          </p>
        </div>
        <Button onClick={() => router.push("/score")}>✦ Score content</Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles"
          className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-[13px] bg-[var(--card)] min-w-[200px]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-[13px] bg-[var(--card)]"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="tracking">Tracking</option>
          <option value="posted">Posted</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <div className="p-8 text-center text-[var(--ink-2)]">
            No content yet.{" "}
            <button
              type="button"
              className="text-[var(--violet-deep)] font-semibold bg-transparent border-none cursor-pointer"
              onClick={() => router.push("/score")}
            >
              Score your first video
            </button>
          </div>
        </Panel>
      ) : (
        <Panel noPadding>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Content", "Score", "Status", "Predicted vs real"].map((h) => (
                    <th
                      key={h}
                      className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-[var(--ink-3)] text-left px-5 py-2.5 border-b border-[var(--line)] font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const mid =
                    row.predictedViewsLow != null && row.predictedViewsHigh != null
                      ? Math.round((row.predictedViewsLow + row.predictedViewsHigh) / 2)
                      : null;
                  return (
                    <tr
                      key={row.id}
                      className="table-row cursor-pointer"
                      onClick={() => router.push(`/content/${row.id}`)}
                    >
                      <td className="px-5 py-3 border-b border-[var(--line)]">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-8 rounded-[7px] shrink-0"
                            style={{ background: row.thumbnailUrl ?? "var(--tint)" }}
                          />
                          <div>
                            <div className="font-semibold text-[13px]">{row.title}</div>
                            <div className="text-[11px] text-[var(--ink-3)]">
                              {platformLabel(row.platform)} · {formatDuration(row.durationSec)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 border-b border-[var(--line)]">
                        {row.score != null ? <ScoreRing score={row.score} /> : "—"}
                      </td>
                      <td className="px-5 py-3 border-b border-[var(--line)]">
                        <Chip status={row.status} />
                      </td>
                      <td className="px-5 py-3 border-b border-[var(--line)] font-mono text-[12px]">
                        {row.actualViews != null
                          ? formatViews(row.actualViews)
                          : mid != null
                            ? formatViews(mid)
                            : "—"}{" "}
                        <span className="text-[var(--ink-3)] text-[10.5px]">
                          {row.actualViews != null && mid != null
                            ? row.actualViews >= (row.predictedViewsLow ?? 0) &&
                              row.actualViews <= (row.predictedViewsHigh ?? 0)
                              ? `vs ${formatViews(mid)} predicted ▲`
                              : row.actualViews > (row.predictedViewsHigh ?? 0)
                                ? `vs ${formatViews(mid)} predicted ▲`
                                : `vs ${formatViews(mid)} predicted ▼`
                            : "predicted"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
