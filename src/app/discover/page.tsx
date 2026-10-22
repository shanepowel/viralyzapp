import { AppPage } from "@/components/shell/AppPage";
import { DiscoverView } from "@/components/discover/DiscoverView";
import { isVendorAdsEnabled, metaAdLibraryToken } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return (
    <AppPage>
      <DiscoverView metaConfigured={Boolean(metaAdLibraryToken())} vendorEnabled={isVendorAdsEnabled()} />
    </AppPage>
  );
}
