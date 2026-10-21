import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { getMomentum } from "@/lib/dashboard";
import { isClerkEnabled } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getClerkIdentity, resolveAppUser } from "@/lib/users";

export async function AppPage({ children }: { children: ReactNode }) {
  const user = await resolveAppUser();
  if (!user) {
    if (isClerkEnabled()) {
      const clerk = await getClerkIdentity();
      if (clerk) redirect("/claim-invite");
    }
    redirect("/login");
  }

  const [libraryCount, momentum] = await Promise.all([
    prisma.content.count({
      where: { userId: user.id, NOT: { title: { startsWith: "Archive" } } },
    }),
    getMomentum(user.id),
  ]);

  return (
    <AppShell
      userName={user.name}
      plan={user.plan}
      creditsRemaining={user.creditsRemaining}
      libraryCount={libraryCount}
      isAdmin={user.role === "admin"}
      showOnboarding={!user.onboardingDone}
      clerkEnabled={isClerkEnabled()}
      momentum={momentum}
    >
      {children}
    </AppShell>
  );
}
