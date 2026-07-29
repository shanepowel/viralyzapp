import { Suspense } from "react";
import { AppPage } from "@/components/shell/AppPage";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MarketingLanding } from "@/components/marketing/MarketingLanding";
import { getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
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
