import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { matchRowsByTag, parseExport } from "@/lib/results/parse";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");
  const filename = url.searchParams.get("filename") ?? "import.csv";
  if (platform !== "meta" && platform !== "tiktok") {
    return NextResponse.json({ error: "platform must be meta or tiktok" }, { status: 400 });
  }

  const csv = await req.text();
  if (!csv.trim()) {
    return NextResponse.json({ error: "The uploaded file is empty" }, { status: 400 });
  }

  const { rows, rejected } = parseExport(csv, platform);

  // Scoped to the importing user's own creatives — a tag can never match
  // across accounts.
  const creatives = await prisma.creative.findMany({
    where: { userId: auth.session.userId },
    select: { id: true, tag: true },
  });
  const creativeIdByTag = new Map(creatives.map((c) => [c.tag.toLowerCase(), c.id]));
  const { matched, unmatched } = matchRowsByTag(rows, creativeIdByTag);

  const performanceImport = await prisma.performanceImport.create({
    data: {
      userId: auth.session.userId,
      platform,
      filename,
      rowsTotal: rows.length + rejected.length,
      rowsMatched: matched.length,
      rowsRejected: rejected,
      rows: {
        create: [
          ...matched.map((row) => ({
            creativeId: row.creativeId,
            adName: row.adName,
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            purchases: row.purchases,
            revenue: row.revenue,
            matched: true,
          })),
          ...unmatched.map((row) => ({
            creativeId: null,
            adName: row.adName,
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            purchases: row.purchases,
            revenue: row.revenue,
            matched: false,
          })),
        ],
      },
    },
    include: { rows: true },
  });

  return NextResponse.json({ import: performanceImport });
}
