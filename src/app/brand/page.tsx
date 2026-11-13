import { AppPage } from "@/components/shell/AppPage";
import { BrandView } from "@/components/brand/BrandView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand" };

export default function BrandPage() {
  return (
    <AppPage>
      <BrandView />
    </AppPage>
  );
}
