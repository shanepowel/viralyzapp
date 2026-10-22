import { AppPage } from "@/components/shell/AppPage";
import { StudioView } from "@/components/studio/StudioView";
import { generationAvailable } from "@/lib/generation";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reference?: string | string[] }> };

export default async function StudioPage({ searchParams }: Props) {
  const { reference } = await searchParams;
  return (
    <AppPage>
      <StudioView
        initialReferenceId={typeof reference === "string" ? reference : null}
        generationAvailable={generationAvailable()}
      />
    </AppPage>
  );
}
