import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ScoreResultsView } from "@/components/score/ScoreResultsView";
import { getSessionUser, requirePageSession } from "@/lib/auth";
import { getContentLatest } from "@/lib/content";
import { isClerkEnabled } from "@/lib/env";
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
  const user = await getSessionUser();

  return (
    <AppShell
      userName={user?.name ?? data.user.name}
      momentum={[5, 7, 6, 9, 11, 14]}
      plan={user?.plan}
      creditsRemaining={user?.creditsRemaining}
      isAdmin={user?.role === "admin"}
      showOnboarding={user ? !user.onboardingDone : false}
      clerkEnabled={isClerkEnabled()}
    >
      <ScoreResultsView data={data} />
    </AppShell>
  );
}
