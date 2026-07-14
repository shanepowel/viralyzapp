import { AppPage } from "@/components/shell/AppPage";
import { Panel } from "@/components/ui/Panel";
import { getSession } from "@/lib/auth";
import { formatViews } from "@/lib/score-bands";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const content = await prisma.content.findMany({
    where: { userId: session.userId },
    include: {
      performance: { orderBy: { measuredAt: "desc" }, take: 1 },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { score: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const scored = content.filter((c) => c.versions[0]?.score);
  const withActual = scored.filter((c) => c.performance[0]);
  let hits = 0;
  for (const c of withActual) {
    const s = c.versions[0]!.score!;
    const a = c.performance[0]!.actualViews;
    if (a >= s.predictedViewsLow && a <= s.predictedViewsHigh) hits += 1;
  }
  const accuracy = withActual.length ? Math.round((hits / withActual.length) * 100) : 0;
  const scoreSeries = scored
    .slice(0, 8)
    .reverse()
    .map((c) => c.versions[0]!.score!.overallScore);
  const maxScore = Math.max(...scoreSeries, 1);

  return (
    <AppPage>
      <div className="vfade">
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Analytics</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            Prediction accuracy, score trend, and predicted vs real views.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <Panel>
            <div className="p-5">
              <div className="text-[12px] text-[var(--ink-3)]">Predictions right</div>
              <div className="font-display text-[32px] font-bold">{accuracy}%</div>
              <div className="text-[11.5px] text-[var(--ink-3)] mt-1">
                Based on {withActual.length} posts with real views
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="p-5">
              <div className="text-[12px] text-[var(--ink-3)]">Scored drafts</div>
              <div className="font-display text-[32px] font-bold">{scored.length}</div>
            </div>
          </Panel>
          <Panel>
            <div className="p-5">
              <div className="text-[12px] text-[var(--ink-3)]">Avg score</div>
              <div className="font-display text-[32px] font-bold">
                {scoreSeries.length
                  ? Math.round(scoreSeries.reduce((a, b) => a + b, 0) / scoreSeries.length)
                  : "—"}
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Score trend" className="mb-5">
          <div className="px-5 py-4 flex items-end gap-2 h-[120px]">
            {scoreSeries.length === 0 ? (
              <div className="text-[var(--ink-3)] text-[13px]">Score content to see a trend.</div>
            ) : (
              scoreSeries.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-[6px]"
                    style={{
                      height: `${(v / maxScore) * 80}px`,
                      background: i === scoreSeries.length - 1 ? "var(--violet)" : "var(--violet-soft)",
                    }}
                  />
                  <span className="font-mono text-[10px] text-[var(--ink-3)]">{v}</span>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Predicted vs real" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Content", "Predicted", "Real", "Delta"].map((h) => (
                    <th
                      key={h}
                      className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-[var(--ink-3)] text-left px-5 py-2.5 border-b border-[var(--line)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withActual.map((c) => {
                  const s = c.versions[0]!.score!;
                  const mid = Math.round((s.predictedViewsLow + s.predictedViewsHigh) / 2);
                  const actual = c.performance[0]!.actualViews;
                  const delta = actual - mid;
                  return (
                    <tr key={c.id}>
                      <td className="px-5 py-3 border-b border-[var(--line)] text-[13px] font-medium">
                        {c.title}
                      </td>
                      <td className="px-5 py-3 border-b border-[var(--line)] font-mono text-[12px]">
                        {formatViews(mid)}
                      </td>
                      <td className="px-5 py-3 border-b border-[var(--line)] font-mono text-[12px]">
                        {formatViews(actual)}
                      </td>
                      <td
                        className="px-5 py-3 border-b border-[var(--line)] font-mono text-[12px]"
                        style={{ color: delta >= 0 ? "var(--s90)" : "var(--s30)" }}
                      >
                        {delta >= 0 ? "▲" : "▼"} {formatViews(Math.abs(delta))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {withActual.length === 0 && (
              <div className="p-6 text-[var(--ink-3)] text-[13px]">
                Honesty layer activates once posts have real view data.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
