import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { getSession, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function AppPage({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getSessionUser();
  const libraryCount = await prisma.content.count({
    where: { userId: session.userId, NOT: { title: { startsWith: "Archive" } } },
  });

  return (
    <AppShell
      userName={user?.name ?? session.name}
      plan={user?.plan}
      creditsRemaining={user?.creditsRemaining}
      libraryCount={libraryCount}
      momentum={[5, 7, 6, 9, 11, 14]}
    >
      {children}
    </AppShell>
  );
}
