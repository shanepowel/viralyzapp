import { AppPage } from "@/components/shell/AppPage";
import { BrandView } from "@/components/brand/BrandView";

export const dynamic = "force-dynamic";

export default function BrandPage() {
  return (
    <AppPage>
      <BrandView />
    </AppPage>
  );
}
