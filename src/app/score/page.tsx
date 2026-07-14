import { Suspense } from "react";
import { AppPage } from "@/components/shell/AppPage";
import { ScoreUploadView } from "@/components/score/ScoreUploadView";

export const dynamic = "force-dynamic";

export default function ScorePage() {
  return (
    <AppPage>
      <Suspense fallback={<div className="py-8 text-[var(--ink-3)]">Loading…</div>}>
        <ScoreUploadView />
      </Suspense>
    </AppPage>
  );
}
