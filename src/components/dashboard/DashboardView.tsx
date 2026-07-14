"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { StatCard } from "@/components/ui/StatCard";
import { formatDuration, formatViews } from "@/lib/score-bands";
import type { DashboardResponse } from "@/lib/types";

function splitInsight(statement: string): { bold: string; rest: string } {
  const patterns = [
    /^(Questions in your first line)(\s.+)$/,
    /^(Tuesday and Thursday, 6pm)(\s.+)$/,
    /^(40 to 60 second videos)(\s.+)$/,
  ];
  for (const p of patterns) {
    const m = statement.match(p);
    if (m) return { bold: m[1], rest: m[2].trim() };
  }
  const space = statement.indexOf(" ");
  if (space === -1) return { bold: statement, rest: "" };
  return { bold: statement.slice(0, space), rest: statement.slice(space + 1) };
}

function relativeSync(iso: string) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
  return `${hours}h ago`;
}

type Props = {
  data: DashboardResponse;
};

export function DashboardView({ data }: Props) {
  const router = useRouter();
  const firstName = data.user.name.split(" ")[0];

  async function connectPlatform() {
    await fetch("/api/platforms/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "tiktok" }),
    });
    alert("Demo: OAuth connect is stubbed. See BACKEND.md for provider wiring.");
  }

  return (
    <div className="vfade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-[22px] pb-[26px] sticky top-0 bg-[var(--paper)] z-10">
        <div>
          <h1 className="font-display text-2xl font-bold m-0">Good morning, {firstName}</h1>
          <div className="text-[13px] text-[var(--ink-3)] mt-0.5">
            Tuesday 14 July · your audience peaks at 6pm today
          </div>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <span className="font-mono text-[11.5px] bg-[var(--card)] border border-[var(--line)] rounded-full px-3.5 py-[7px] text-[var(--ink-2)]">
            Creator plan ·{" "}
            <b className="text-[var(--violet-deep)]">
              {data.user.plan === "unlimited" ? "unlimited scores" : "credits"}
            </b>
          </span>
          <Button variant="outline" onClick={connectPlatform}>
            Connect platform
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard
          label="Your score this month"
          value={data.monthlyScore}
          delta={data.monthlyScoreDelta}
          footnote={`Average across ${data.monthlyPostCount} posts`}
          sparkline={data.monthlySparkline}
        />
        <StatCard
          label="Predictions right"
          value={`${data.predictionAccuracyPct}%`}
          delta={data.accuracyDelta}
          footnote={
            <>
              Based on your last {data.accuracySampleSize} posts ·{" "}
              <a href="#how" className="text-[var(--violet-deep)] cursor-pointer">
                how we work this out
              </a>
            </>
          }
        />
        <div className="sm:col-span-2 relative overflow-hidden rounded-[14px] p-5 text-white bg-gradient-to-br from-[var(--violet)] to-[var(--violet-deep)]">
          <div className="text-[12px] text-white/75 font-medium mb-2.5">Next best thing to do</div>
          <div className="font-display text-[17px] font-semibold leading-[1.35] mb-3">
            {data.nextBestAction?.reason ??
              "Score a new draft to unlock your next best action."}
          </div>
          {data.nextBestAction && (
            <Button
              className="!bg-white !text-[var(--violet-deep)] text-[12.5px] px-3.5 py-2"
              onClick={() => router.push(`/content/${data.nextBestAction!.contentId}`)}
            >
              Schedule it for {data.nextBestAction.suggestedSlot}
            </Button>
          )}
          <div className="absolute -right-[22px] -top-[22px] w-[110px] h-[110px] rounded-full border-[18px] border-white/8 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5 items-start">
        <Panel
          title="Recent scores"
          meta={
            <Link href="/library" className="text-[12.5px] text-[var(--violet-deep)] font-semibold">
              View library
            </Link>
          }
          noPadding
        >
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
                {data.recentScores.map((row) => (
                  <tr
                    key={row.contentId}
                    className="table-row cursor-pointer"
                    onClick={() => router.push(`/content/${row.contentId}`)}
                  >
                    <td className="px-5 py-3 border-b border-[var(--line)] align-middle">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-8 rounded-[7px] shrink-0"
                          style={{
                            background: row.thumbnailUrl ?? "var(--tint)",
                          }}
                        />
                        <div>
                          <div className="font-semibold text-[13px]">{row.title}</div>
                          <div className="text-[11px] text-[var(--ink-3)]">
                            {row.platform} · {formatDuration(row.durationSec)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 border-b border-[var(--line)] align-middle">
                      <ScoreRing score={row.score} />
                    </td>
                    <td className="px-5 py-3 border-b border-[var(--line)] align-middle">
                      <Chip status={row.status} />
                    </td>
                    <td className="px-5 py-3 border-b border-[var(--line)] align-middle font-mono text-[12px]">
                      {formatViews(row.actualViews ?? row.predictedViews)}{" "}
                      <span className="text-[var(--ink-3)] text-[10.5px]">{row.vsNote}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel
            title="What works for you"
            meta={
              <Link href="/analytics" className="text-[12.5px] text-[var(--violet-deep)] font-semibold">
                Analytics
              </Link>
            }
          >
            <div className="px-5 pb-3.5 pt-2">
              {data.insights.map((w) => {
                const { bold, rest } = splitInsight(w.statement);
                return (
                  <div
                    key={w.id}
                    className="flex gap-3 py-[11px] border-b border-[var(--line)] last:border-b-0 text-[13px] text-[var(--ink-2)] items-start"
                  >
                    <div className="w-[26px] h-[26px] rounded-lg bg-[var(--s90-soft)] text-[var(--s90)] flex items-center justify-center text-[12px] shrink-0 font-bold">
                      {w.icon}
                    </div>
                    <div>
                      <b className="text-[var(--ink)]">{bold}</b> {rest}
                      <span className="block text-[11px] text-[var(--ink-3)] mt-0.5">
                        {w.supportingNote}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Your media kit"
            meta={
              <Link href="/media-kit" className="text-[12.5px] text-[var(--violet-deep)] font-semibold">
                Open
              </Link>
            }
          >
            <div className="px-5 py-4">
              <div className="flex justify-between text-[13px] py-[7px] text-[var(--ink-2)]">
                <span>Kit views this week</span>
                <b className="font-mono text-[var(--ink)]">{data.mediaKit?.viewsThisWeek ?? 0}</b>
              </div>
              <div className="flex justify-between text-[13px] py-[7px] text-[var(--ink-2)]">
                <span>Package orders</span>
                <b className="font-mono text-[var(--ink)]">
                  {data.mediaKit?.newOrdersCount ?? 0} new
                </b>
              </div>
              <div className="flex justify-between text-[13px] py-[7px] text-[var(--ink-2)]">
                <span>Verified sync</span>
                <b className="font-mono text-[var(--s90)]">
                  {data.mediaKit ? relativeSync(data.mediaKit.lastSyncedAt) : "—"}
                </b>
              </div>
              <Button variant="outline" className="w-full mt-2.5">
                View orders
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
