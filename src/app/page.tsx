import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/shell/AppPage";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MarketingLanding } from "@/components/marketing/MarketingLanding";
import { getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { isClerkEnabled } from "@/lib/env";
import { getClerkIdentity } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    if (isClerkEnabled()) {
      const clerk = await getClerkIdentity();
      if (clerk) redirect("/claim-invite");
    }
    return <MarketingLanding />;
  }

  const data = await getDashboard(session.userId);
  return (
    <AppPage>
      <Suspense fallback={null}>
        <DashboardView data={data} />
      </Suspense>
    </AppPage>
  );
}
