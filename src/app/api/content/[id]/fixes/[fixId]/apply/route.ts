import { NextResponse } from "next/server";
import { enqueueScoreJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; fixId: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id, fixId } = await params;

    const fix = await prisma.fix.findUnique({
      where: { id: fixId },
      include: { contentVersion: true },
    });

    if (!fix || fix.contentVersion.contentId !== id) {
      return NextResponse.json({ error: "Fix not found" }, { status: 404 });
    }

    await prisma.fix.update({
      where: { id: fixId },
      data: {
        applied: true,
        appliedAt: new Date(),
        pointsEarned: fix.pointValue,
      },
    });

    const jobId = await enqueueScoreJob(id);

    // Wait briefly for mock job so UI can refresh with new version
    await new Promise((r) => setTimeout(r, 800));

    const job = await prisma.scoreJob.findUnique({ where: { id: jobId } });

    return NextResponse.json({
      jobId,
      status: job?.status ?? "queued",
      result: job?.result ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply fix";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
