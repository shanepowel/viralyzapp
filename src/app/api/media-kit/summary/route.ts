import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  try {
    const kit = await prisma.mediaKit.findUnique({
      where: { userId: auth.session.userId },
      include: { user: { select: { id: true, name: true, handle: true } } },
    });
    if (!kit) {
      return NextResponse.json({ error: "No media kit" }, { status: 404 });
    }
    return NextResponse.json({
      viewsThisWeek: kit.viewsThisWeek,
      newOrdersCount: kit.newOrdersCount,
      followers: kit.followers,
      engagementPct: kit.engagementPct,
      lastSyncedAt: kit.lastSyncedAt.toISOString(),
      user: kit.user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load media kit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
