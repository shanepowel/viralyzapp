import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const creative = await prisma.creative.findFirst({
    where: { id, userId: auth.session.userId },
    include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  if (!creative) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ creative });
}
