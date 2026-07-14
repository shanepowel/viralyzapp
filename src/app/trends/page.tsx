import Link from "next/link";
import { AppPage } from "@/components/shell/AppPage";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  switch (status) {
    case "jump_in":
      return { label: "Jump in", bg: "var(--s90-soft)", color: "var(--s90)" };
    case "dying":
      return { label: "Dying", bg: "var(--s30-soft)", color: "var(--s30)" };
    default:
      return { label: "Stable", bg: "var(--tint)", color: "var(--ink-2)" };
  }
}

export default async function TrendsPage() {
  const trends = await prisma.trend.findMany({ orderBy: { velocity: "desc" } });

  return (
    <AppPage>
      <div className="vfade">
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Trends</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            What is rising in your niche — and when to skip.
          </p>
        </div>
        <div className="grid gap-3">
          {trends.map((t) => {
            const chip = statusLabel(t.status);
            return (
              <Panel key={t.id}>
                <div className="p-4 flex flex-wrap items-center gap-4 justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-1">
                      {t.niche} · velocity {t.velocity}
                    </div>
                    <div className="font-semibold text-[15px]">{t.title}</div>
                    <div className="text-[12.5px] text-[var(--ink-2)] mt-1">{t.note}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[11px] font-semibold rounded-full px-3 py-1"
                      style={{ background: chip.bg, color: chip.color }}
                    >
                      {chip.label}
                    </span>
                    <Link href={`/score?title=${encodeURIComponent(t.title)}`}>
                      <Button size="sm">Make my version</Button>
                    </Link>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </AppPage>
  );
}
