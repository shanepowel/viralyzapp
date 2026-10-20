import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  try {
    const content = await prisma.content.findMany({
      where: { userId: auth.session.userId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { score: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    });
    const series = content
      .map((c) => c.versions[0]?.score?.overallScore)
      .filter((n): n is number => n != null)
      .reverse();
    // Empty when the user has no scored content. Previously fell back to a
    // hardcoded series, which rendered an invented trend line for new accounts.
    return NextResponse.json({
      userId: auth.session.userId,
      series,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load momentum";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
