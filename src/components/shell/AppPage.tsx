import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { balance } from "@/lib/credits";
import { isClerkEnabled } from "@/lib/env";
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

  return (
    <AppShell
      userName={user.name}
      plan={user.plan}
      balance={userBalance}
      isAdmin={user.role === "admin"}
      showOnboarding={!user.onboardingDone}
      clerkEnabled={isClerkEnabled()}
    >
      {children}
    </AppShell>
  );
}
