import { AppPage } from "@/components/shell/AppPage";
import { LibraryView } from "@/components/library/LibraryView";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = await prisma.content.findMany({
    where: { userId: session.userId, NOT: { title: { startsWith: "Archive" } } },
    include: {
      platform: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { score: true },
      },
      performance: { orderBy: { measuredAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppPage>
      <LibraryView
        items={items.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          durationSec: c.durationSec,
          thumbnailUrl: c.thumbnailUrl,
          platform: c.platform?.provider ?? null,
          score: c.versions[0]?.score?.overallScore ?? null,
          actualViews: c.performance[0]?.actualViews ?? null,
          predictedViewsLow: c.versions[0]?.score?.predictedViewsLow ?? null,
          predictedViewsHigh: c.versions[0]?.score?.predictedViewsHigh ?? null,
        }))}
      />
    </AppPage>
  );
}
