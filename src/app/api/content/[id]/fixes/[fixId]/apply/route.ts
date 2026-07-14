import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { enqueueScoreJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; fixId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const { id, fixId } = await params;

    const content = await prisma.content.findFirst({
      where: { id, userId: auth.session.userId },
    });
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

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

    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.session.userId } });
    if (user.plan !== "unlimited") {
      if (user.creditsRemaining <= 0) {
        return NextResponse.json({ error: "No credits left to re-score." }, { status: 402 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { creditsRemaining: { decrement: 1 } },
      });
    }

    const jobId = await enqueueScoreJob(id);
    await new Promise((r) => setTimeout(r, 900));
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
