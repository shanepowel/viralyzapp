"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FixCard } from "@/components/ui/FixCard";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { componentColor, formatViews } from "@/lib/score-bands";
import type { ContentLatestResponse } from "@/lib/types";

const COMPONENT_ORDER = ["opening", "visuals", "pacing", "words", "timing"] as const;

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function curvePath(points: { tSeconds: number; pctRemaining: number }[], w = 600, h = 120) {
  if (points.length === 0) return { line: "", area: "", risk: null as null | { x: number; y: number } };
  const maxT = Math.max(...points.map((p) => p.tSeconds), 1);
  const coords = points.map((p) => ({
    x: (p.tSeconds / maxT) * w,
    y: h - (p.pctRemaining / 100) * (h - 20) - 8,
    t: p.tSeconds,
  }));
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area, coords };
}

type Props = {
  data: ContentLatestResponse;
};

export function ScoreResultsView({ data: initial }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busyFixId, setBusyFixId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  async function refresh() {
    const res = await fetch(`/api/content/${data.content.id}/latest`);
    if (res.ok) {
      setData(await res.json());
    }
  }

  async function applyFix(fixId: string) {
    setBusyFixId(fixId);
    try {
      const res = await fetch(`/api/content/${data.content.id}/fixes/${fixId}/apply`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Apply failed");
      await refresh();
    } finally {
      setBusyFixId(null);
    }
  }

  async function scoreAgain() {
    const res = await fetch(`/api/content/${data.content.id}/score`, { method: "POST" });
    const json = await res.json();
    if (json.jobId) {
      await new Promise((r) => setTimeout(r, 900));
      await refresh();
    }
  }

  async function schedule() {
    await fetch(`/api/content/${data.content.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await refresh();
    router.push("/");
  }

  const delta =
    data.priorVersion != null
      ? data.score.overallScore - data.priorVersion.overallScore
      : null;

  const curve = data.retentionCurve
    ? curvePath(data.retentionCurve.curvePoints)
    : null;
  const riskX =
    data.retentionCurve?.riskMomentSec != null && curve && "coords" in curve && curve.coords
      ? (() => {
          const maxT = Math.max(...data.retentionCurve!.curvePoints.map((p) => p.tSeconds), 1);
          const x = (data.retentionCurve!.riskMomentSec! / maxT) * 600;
          const nearest = data.retentionCurve!.curvePoints.reduce((a, b) =>
            Math.abs(a.tSeconds - data.retentionCurve!.riskMomentSec!) <
            Math.abs(b.tSeconds - data.retentionCurve!.riskMomentSec!)
              ? a
              : b,
          );
          const y = 120 - (nearest.pctRemaining / 100) * 100 - 8;
          return { x, y };
        })()
      : null;

  const visibleFixes = data.fixes.filter((f) => !skipped.has(f.id));

  return (
    <div className="vfade pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-[22px] pb-[26px] sticky top-0 bg-[var(--paper)] z-10">
        <div>
          <h1 className="font-display text-2xl font-bold m-0">{data.content.title}</h1>
          <div className="text-[13px] text-[var(--ink-3)] mt-0.5">
            Scored {timeAgo(data.score.computedAt)} · version {data.version.versionNumber}
            {data.priorVersion && (
              <>
                {" "}
                ·{" "}
                <span className="text-[var(--violet-deep)]">
                  see version {data.priorVersion.versionNumber} ({data.priorVersion.overallScore})
                </span>
              </>
            )}
          </div>
        </div>
        <span className="font-mono text-[11.5px] bg-[var(--card)] border border-[var(--line)] rounded-full px-3.5 py-[7px] text-[var(--ink-2)] self-start">
          Creator plan ·{" "}
          <b className="text-[var(--violet-deep)]">
            {data.user.plan === "unlimited" ? "unlimited scores" : "credits"}
          </b>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_auto] gap-7 items-center bg-[var(--card)] border border-[var(--line)] rounded-[14px] px-7 py-[26px] mb-5">
        <ScoreRing score={data.score.overallScore} size="lg" />
        <div>
          <h2 className="text-[21px] m-0 mb-1.5 font-semibold">{data.score.verdict}</h2>
          <div className="flex gap-2.5 items-center flex-wrap mb-3">
            <span className="text-[11.5px] font-semibold bg-[var(--tint)] rounded-full px-3 py-1 inline-flex items-center gap-1.5">
              <span
                className="w-[7px] h-[7px] rounded-[2px] inline-block"
                style={{
                  background:
                    data.content.platform === "TikTok"
                      ? "#FF0050"
                      : data.content.platform === "Reels"
                        ? "#E1306C"
                        : "#FF0000",
                }}
              />
              {data.content.platform}
            </span>
            {delta != null && delta > 0 && (
              <span className="text-[11.5px] font-semibold rounded-full px-3 py-1 inline-flex bg-[var(--s90-soft)] text-[var(--s90)]">
                Up {delta} from version {data.priorVersion!.versionNumber}
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-[var(--ink-3)]">
            We are{" "}
            <b className="text-[var(--ink-2)]">{data.score.confidencePct}% confident</b> in this
            prediction, based on {data.score.sampleSize} of your posts. Predicted views:{" "}
            <b className="text-[var(--ink-2)]">
              {formatViews(data.score.predictedViewsLow)} to{" "}
              {formatViews(data.score.predictedViewsHigh)}
            </b>
            .
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={schedule}>Schedule for 6pm</Button>
          <Button variant="outline" onClick={scoreAgain}>
            Score again
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-5">
        {COMPONENT_ORDER.map((key) => {
          const val = data.score.componentScores[key];
          const note = data.score.componentNotes[key];
          const color = componentColor(val);
          const label = key[0].toUpperCase() + key.slice(1);
          return (
            <div
              key={key}
              className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4"
            >
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-semibold text-[13px]">{label}</span>
                <span className="font-mono text-[12px] text-[var(--ink-3)]">{val}/20</span>
              </div>
              <div className="h-1.5 bg-[var(--tint)] rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(val / 20) * 100}%`, background: color }}
                />
              </div>
              <p className="text-[11.5px] text-[var(--ink-2)] leading-[1.45] m-0">{note}</p>
            </div>
          );
        })}
      </div>

      <Panel
        title="Fixes"
        meta={<span className="text-[12px] text-[var(--ink-3)]">Ordered by what they are worth</span>}
        className="mb-5"
        noPadding
      >
        {visibleFixes.map((f) => (
          <FixCard
            key={f.id}
            {...f}
            busy={busyFixId === f.id}
            onApply={() => applyFix(f.id)}
            onSkip={() => setSkipped((s) => new Set(s).add(f.id))}
          />
        ))}
      </Panel>

      <Panel
        title="Where people will stay and leave"
        meta={<span className="text-[12px] text-[var(--ink-3)]">Predicted watch curve</span>}
      >
        <div className="p-5">
          <svg className="w-full h-[120px]" viewBox="0 0 600 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6C4CF1" stopOpacity="0.18" />
                <stop offset="1" stopColor="#6C4CF1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {curve && (
              <>
                <path d={curve.area} fill="url(#rg)" />
                <path d={curve.line} fill="none" stroke="#6C4CF1" strokeWidth="2.5" />
              </>
            )}
            {riskX && <circle cx={riskX.x} cy={riskX.y} r="5" fill="#D9950B" />}
          </svg>
          {data.retentionCurve?.riskNote && (
            <div className="text-[12px] text-[var(--ink-2)] flex gap-2 items-center mt-2.5">
              <span className="w-[18px] h-[18px] rounded-full bg-[var(--s50-soft)] text-[var(--s50)] flex items-center justify-center text-[10px] font-bold shrink-0">
                !
              </span>
              {data.retentionCurve.riskNote}
            </div>
          )}
        </div>
      </Panel>

      <StickyActionBar>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Save draft
        </Button>
        <Button variant="outline" onClick={scoreAgain}>
          Score again
        </Button>
        <Button onClick={schedule}>Schedule for 6pm</Button>
      </StickyActionBar>

      <div className="mt-4">
        <Link href="/" className="text-[12.5px] text-[var(--violet-deep)] font-semibold">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
