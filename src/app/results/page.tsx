import { AppPage } from "@/components/shell/AppPage";
import { ResultsView } from "@/components/results/ResultsView";

export const dynamic = "force-dynamic";

export default function ResultsPage() {
  return (
    <AppPage>
      <ResultsView />
    </AppPage>
  );
}
