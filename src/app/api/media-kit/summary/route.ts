import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const kit = await prisma.mediaKit.findFirst({
      include: { user: { select: { id: true, name: true } } },
    });
    if (!kit) {
      return NextResponse.json({ error: "No media kit" }, { status: 404 });
    }
    return NextResponse.json({
      viewsThisWeek: kit.viewsThisWeek,
      newOrdersCount: kit.newOrdersCount,
      lastSyncedAt: kit.lastSyncedAt.toISOString(),
      user: kit.user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load media kit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
