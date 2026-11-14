import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { balance } from "@/lib/credits";
import { isClerkEnabled } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
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

  const userBalance = await balance(user.id);
  // The first-run strip is for someone who has not set anything up. Once a
  // brand is confirmed it has done its job, dismissed or not.
  const hasBrand = user.onboardingDone
    ? true
    : (await prisma.brand.count({ where: { userId: user.id, confirmedAt: { not: null } } })) > 0;

  return (
    <AppShell
      userName={user.name}
      plan={user.plan}
      balance={userBalance}
      isAdmin={isStaffRole(user.role)}
      showOnboarding={!user.onboardingDone && !hasBrand}
      clerkEnabled={isClerkEnabled()}
    >
      {children}
    </AppShell>
  );
}
