import { notFound } from "next/navigation";
import { AppPage } from "@/components/shell/AppPage";
import { ScoreResultsView } from "@/components/score/ScoreResultsView";
import { requirePageSession } from "@/lib/auth";
import { getContentLatest } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ContentPage({ params }: Props) {
  const session = await requirePageSession();

  const { id } = await params;
  const exists = await prisma.content.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!exists) notFound();

  const data = await getContentLatest(id, session.userId);

  return (
    <AppPage>
      <ScoreResultsView data={data} />
    </AppPage>
  );
}
