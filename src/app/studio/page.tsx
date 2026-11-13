import { AppPage } from "@/components/shell/AppPage";
import { toCreativeDTO, type CreativeDTO } from "@/components/studio/proof";
import { StudioView } from "@/components/studio/StudioView";
import { creditPricePerVariant } from "@/lib/env";
import { continueOpenCreativesForUser, generationAvailable } from "@/lib/generation";
import { prisma } from "@/lib/prisma";
import { scheduleCreative } from "@/lib/schedule-creative";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio" };

type Props = { searchParams: Promise<{ reference?: string | string[]; new?: string | string[] }> };

/** How long after the newest ad another ad still counts as the same batch. */
const BATCH_WINDOW_MS = 10 * 60 * 1000;

/**
 * The last batch, so the desk opens on work rather than on a blank form.
 * There is no batch record: a batch is the newest ad plus the ads for the
 * same product made shortly before it, newest first, one per angle and placement.
 */
async function lastBatch(userId: string): Promise<CreativeDTO[]> {
  const rows = await prisma.creative.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 32,
    include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  const newest = rows[0];
  if (!newest) return [];
  const seen = new Set<string>();
  const batch: CreativeDTO[] = [];
  for (const row of rows) {
    if (row.productId !== newest.productId) continue;
    if (newest.createdAt.getTime() - row.createdAt.getTime() > BATCH_WINDOW_MS) break;
    const cell = `${row.angle}:${row.placement}`;
    if (seen.has(cell)) continue;
    seen.add(cell);
    batch.push(toCreativeDTO(row));
  }
  return batch;
}

export default async function StudioPage({ searchParams }: Props) {
  const { reference, new: startNew } = await searchParams;
  // AppPage redirects when there is no user; this only narrows the type.
  const user = await resolveAppUser();
  let recent: CreativeDTO[] = [];
  if (user) {
    await continueOpenCreativesForUser(user.id, scheduleCreative);
    recent = await lastBatch(user.id);
  }
  return (
    <AppPage>
      <StudioView
        // A fresh instance when the header's "New batch" is used from the desk.
        key={startNew ? "new" : "desk"}
        initialReferenceId={typeof reference === "string" ? reference : null}
        generationAvailable={generationAvailable()}
        creditsPerVariant={creditPricePerVariant()}
        recent={recent}
        startNew={Boolean(startNew)}
      />
    </AppPage>
  );
}
