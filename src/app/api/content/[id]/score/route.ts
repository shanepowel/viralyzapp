import { NextResponse } from "next/server";
import { enqueueScoreJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const content = await prisma.content.findUnique({ where: { id } });
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    const jobId = await enqueueScoreJob(id);
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to enqueue score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
