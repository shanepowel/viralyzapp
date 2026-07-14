import Link from "next/link";
import { AppPage } from "@/components/shell/AppPage";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatViews } from "@/lib/score-bands";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MediaKitPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    include: {
      mediaKit: true,
      content: {
        where: { NOT: { title: { startsWith: "Archive" } } },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: { score: true },
          },
        },
      },
    },
  });

  const scores = user.content
    .map((c) => c.versions[0]?.score?.overallScore)
    .filter((s): s is number => s != null);
  const avg =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const kit = user.mediaKit;

  return (
    <AppPage>
      <div className="vfade">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-[22px] pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold m-0">Media Kit</h1>
            <p className="text-[13px] text-[var(--ink-3)] mt-1">
              Verified numbers. Share one link with brands.
            </p>
          </div>
          {user.handle && (
            <Link href={`/kit/${user.handle}`} target="_blank">
              <Button variant="outline">Open public kit</Button>
            </Link>
          )}
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mb-5">
          <Panel>
            <div className="p-5 flex items-center gap-3">
              <ScoreRing score={avg || 70} size="sm" />
              <div>
                <div className="text-[12px] text-[var(--ink-3)]">Avg score</div>
                <div className="font-display text-[24px] font-bold">{avg || "—"}</div>
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="p-5">
              <div className="text-[12px] text-[var(--ink-3)]">Followers</div>
              <div className="font-display text-[24px] font-bold">
                {kit ? formatViews(kit.followers) : "—"}
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="p-5">
              <div className="text-[12px] text-[var(--ink-3)]">Engagement</div>
              <div className="font-display text-[24px] font-bold">
                {kit ? `${kit.engagementPct}%` : "—"}
              </div>
            </div>
          </Panel>
          <Panel>
            <div className="p-5">
              <div className="text-[12px] text-[var(--ink-3)]">Kit views / orders</div>
              <div className="font-display text-[24px] font-bold">
                {kit?.viewsThisWeek ?? 0} / {kit?.newOrdersCount ?? 0}
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Share link">
          <div className="px-5 py-4 text-[13px] text-[var(--ink-2)]">
            {user.handle ? (
              <>
                viralyz.com/kit/<b className="text-[var(--ink)]">{user.handle}</b>
                <div className="mt-2 text-[12px] text-[var(--ink-3)]">
                  Local preview:{" "}
                  <Link href={`/kit/${user.handle}`} className="text-[var(--violet-deep)] font-semibold">
                    /kit/{user.handle}
                  </Link>
                </div>
              </>
            ) : (
              "Set a handle on signup to enable your public kit."
            )}
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
