import { AppShell } from "@/components/shell/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboard();
  return (
    <AppShell userName={data.user.name} momentum={data.user.momentum}>
      <DashboardView data={data} />
    </AppShell>
  );
}
