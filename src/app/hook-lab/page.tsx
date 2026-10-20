import { AppPage } from "@/components/shell/AppPage";
import { HookLabView } from "@/components/create/HookLabView";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HookLabPage() {
  await requirePageSession();

  return (
    <AppPage>
      <HookLabView />
    </AppPage>
  );
}
