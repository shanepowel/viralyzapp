import { AppPage } from "@/components/shell/AppPage";
import { ResultsView, type CreativeRow, type PastImport } from "@/components/results/ResultsView";
import { prisma } from "@/lib/prisma";
import { latestRowPerCreative } from "@/lib/results/calibration";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results" };

export default async function ResultsPage() {
  const user = await resolveAppUser();
  // AppPage redirects when there's no user; this only gives the queries a concrete id.
  const [rows, imports] = user
    ? await Promise.all([
        prisma.performanceRow.findMany({
          where: { matched: true, import: { userId: user.id } },
          include: {
            import: { select: { createdAt: true } },
            creative: { select: { tag: true, checks: { orderBy: { computedAt: "desc" }, take: 1 } } },
          },
        }),
        prisma.performanceImport.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, platform: true, filename: true, rowsTotal: true, rowsMatched: true, createdAt: true },
        }),
      ])
    : [[], []];

  // Same rule as calibration: the newest import's row wins for each variant.
  const initialRows: CreativeRow[] = latestRowPerCreative(
    rows.map((row) => ({ ...row, importedAt: row.import.createdAt })),
  ).map((row) => ({
    id: row.id,
    adName: row.adName,
    impressions: row.impressions,
    clicks: row.clicks,
    matched: row.matched,
    creativeId: row.creativeId,
    headline: row.creative?.checks[0]?.headline ?? null,
  }));

  const pastImports: PastImport[] = imports.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }));

  return (
    <AppPage>
      <ResultsView initialRows={initialRows} pastImports={pastImports} />
    </AppPage>
  );
}
