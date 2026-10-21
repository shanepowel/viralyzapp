import { AppPage } from "@/components/shell/AppPage";
import { ThumbnailsView } from "@/components/create/ThumbnailsView";
import { requirePageSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ThumbnailsPage() {
  await requirePageSession();

  return (
    <AppPage>
      <ThumbnailsView />
    </AppPage>
  );
}
