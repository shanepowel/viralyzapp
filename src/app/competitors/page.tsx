import Link from "next/link";
import { AppPage } from "@/components/shell/AppPage";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { platformLabel } from "@/lib/score-bands";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  const posts = await prisma.competitorPost.findMany({ orderBy: { score: "desc" } });

  return (
    <AppPage>
      <div className="vfade">
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Competitors</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            See why competitor posts worked, then remake your version.
          </p>
        </div>
        <div className="grid gap-3">
          {posts.map((p) => (
            <Panel key={p.id}>
              <div className="p-4 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div
                    className="w-14 h-10 rounded-[8px]"
                    style={{ background: p.thumbnailUrl ?? "var(--tint)" }}
                  />
                  <div>
                    <div className="font-mono text-[10px] text-[var(--ink-3)] uppercase tracking-[0.08em]">
                      {p.creatorName} · {platformLabel(p.platform)}
                    </div>
                    <div className="font-semibold text-[14px]">{p.title}</div>
                    <div className="text-[12.5px] text-[var(--ink-2)] mt-0.5">{p.whyItWorked}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreRing score={p.score} />
                  <Link href={`/hook-lab`}>
                    <Button size="sm" variant="outline">
                      Remake hook
                    </Button>
                  </Link>
                  <Link href={`/score?title=${encodeURIComponent(p.title)}`}>
                    <Button size="sm">Score my take</Button>
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </AppPage>
  );
}
