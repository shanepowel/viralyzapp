import { AppPage } from "@/components/shell/AppPage";
import { StudioView } from "@/components/studio/StudioView";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  return (
    <AppPage>
      <StudioView />
    </AppPage>
  );
}
