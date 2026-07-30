import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";
import { AppPage } from "@/components/shell/AppPage";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await resolveAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/score");

  return (
    <AppPage>
      <AdminView />
    </AppPage>
  );
}
