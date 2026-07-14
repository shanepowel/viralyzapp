import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: "No user" }, { status: 404 });
    }
    return NextResponse.json({
      userId: user.id,
      series: [5, 7, 6, 9, 11, 14],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load momentum";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
