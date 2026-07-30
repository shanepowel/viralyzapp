import { AppPage } from "@/components/shell/AppPage";
import { EngageView } from "@/components/earn/EngageView";
import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EngagePage() {
  const session = await requirePageSession();
  const comments = await prisma.engageComment.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppPage>
      <EngageView comments={comments} />
    </AppPage>
  );
}
