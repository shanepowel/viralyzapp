import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { enqueueScoreJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const ip = clientIp(req);
    const rl = await rateLimit({
      key: `score:${auth.session.userId}:${ip}`,
      limit: 20,
      windowSec: 60,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Scoring too quickly. Try again in a minute." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const { id } = await params;
    const content = await prisma.content.findFirst({
      where: { id, userId: auth.session.userId },
    });
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.session.userId } });
    if (user.plan !== "unlimited" && user.creditsRemaining <= 0) {
      return NextResponse.json(
        { error: "No credits left. Upgrade or wait for more scores." },
        { status: 402 },
      );
    }

    if (user.plan !== "unlimited") {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsRemaining: { decrement: 1 },
          onboardingDone: true,
        },
      });
    } else if (!user.onboardingDone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingDone: true },
      });
    }

    const jobId = await enqueueScoreJob(id);
    return NextResponse.json({
      jobId,
      creditsRemaining: user.plan === "unlimited" ? null : user.creditsRemaining - 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to enqueue score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
