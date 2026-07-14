import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ScoreResultsView } from "@/components/score/ScoreResultsView";
import { getContentLatest } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ContentPage({ params }: Props) {
  const { id } = await params;

  const exists = await prisma.content.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();

  const data = await getContentLatest(id);
  const user = await prisma.user.findFirst();

  return (
    <AppShell userName={user?.name ?? data.user.name} momentum={[5, 7, 6, 9, 11, 14]}>
      <ScoreResultsView data={data} />
    </AppShell>
  );
}
