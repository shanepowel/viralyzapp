import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { calibrate } from "@/lib/results/calibration";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const rows = await prisma.performanceRow.findMany({
    where: { matched: true, import: { userId: auth.session.userId } },
    include: { creative: { include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } } } },
  });

  const pairs = rows
    .map((row) => {
      const headline = row.creative?.checks[0]?.headline;
      if (headline == null) return null;
      return { score: headline, impressions: row.impressions, clicks: row.clicks };
    })
    .filter((p): p is { score: number; impressions: number; clicks: number } => p !== null);

  return NextResponse.json(calibrate(pairs));
}
