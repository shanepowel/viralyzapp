import { Suspense } from "react";
import { AppPage } from "@/components/shell/AppPage";
import { ReferenceRail } from "@/components/score/ReferenceRail";
import { ScoreUploadView } from "@/components/score/ScoreUploadView";
import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ScorePage() {
  const session = await requirePageSession();

  const content = await prisma.content.findMany({
    where: { userId: session.userId, NOT: { title: { startsWith: "Archive" } } },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { score: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  const referenceItems = content
    .filter((c) => c.versions[0]?.score)
    .map((c) => ({ id: c.id, title: c.title, score: c.versions[0].score!.overallScore }));

  return (
    <AppPage>
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <Suspense fallback={<div className="py-8 text-[var(--ink-3)]">Loading…</div>}>
          <ScoreUploadView />
        </Suspense>
        <ReferenceRail items={referenceItems} />
      </div>
    </AppPage>
  );
}
