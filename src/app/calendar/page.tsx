import { AppPage } from "@/components/shell/AppPage";
import { CalendarView } from "@/components/grow/CalendarView";
import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await requirePageSession();

  const items = await prisma.content.findMany({
    where: {
      userId: session.userId,
      OR: [{ scheduledFor: { not: null } }, { postedAt: { not: null } }, { status: "draft" }],
      NOT: { title: { startsWith: "Archive" } },
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { score: true },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return (
    <AppPage>
      <CalendarView
        items={items.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          score: c.versions[0]?.score?.overallScore ?? null,
          scheduledFor: c.scheduledFor?.toISOString() ?? null,
          postedAt: c.postedAt?.toISOString() ?? null,
        }))}
      />
    </AppPage>
  );
}
