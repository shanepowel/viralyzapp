import { AppPage } from "@/components/shell/AppPage";
import { ScriptDoctorView } from "@/components/create/ScriptDoctorView";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ScriptDoctorPage() {
  await requirePageSession();

  return (
    <AppPage>
      <ScriptDoctorView />
    </AppPage>
  );
}
