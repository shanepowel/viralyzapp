import { AppPage } from "@/components/shell/AppPage";
import { CaptionsView } from "@/components/create/CaptionsView";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CaptionsPage() {
  await requirePageSession();

  return (
    <AppPage>
      <CaptionsView />
    </AppPage>
  );
}
