import { redirect } from "next/navigation";
import { AppPage } from "@/components/shell/AppPage";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getDashboard(session.userId);
  return (
    <AppPage>
      <DashboardView data={data} />
    </AppPage>
  );
}
