import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const trends = await prisma.trend.findMany({ orderBy: { velocity: "desc" } });
  return NextResponse.json({ trends });
}
