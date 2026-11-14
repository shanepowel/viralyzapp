import { AppPage } from "@/components/shell/AppPage";
import { BrandView } from "@/components/brand/BrandView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand" };

type Props = { searchParams: Promise<{ import?: string | string[] }> };

export default async function BrandPage({ searchParams }: Props) {
  const { import: importParam } = await searchParams;
  const importUrl = typeof importParam === "string" && /^https?:\/\//i.test(importParam) ? importParam : null;
  return (
    <AppPage>
      <BrandView importUrl={importUrl} />
    </AppPage>
  );
}
