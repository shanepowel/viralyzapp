import { prisma } from "@/lib/prisma";
import { enqueueOnBull, queueBackend } from "@/lib/queue";
import { runScorer } from "@/lib/scoring-service";

type JobStore = Map<string, NodeJS.Timeout>;

const globalForJobs = globalThis as unknown as {
  viralyzJobTimers: JobStore | undefined;
};

const timers: JobStore = globalForJobs.viralyzJobTimers ?? new Map();
if (process.env.NODE_ENV !== "production") {
  globalForJobs.viralyzJobTimers = timers;
}

export async function enqueueScoreJob(contentId: string): Promise<string> {
  const job = await prisma.scoreJob.create({
    data: { contentId, status: "queued" },
  });

  const queued = await enqueueOnBull(job.id);
  if (!queued) {
    const timer = setTimeout(() => {
      void processScoreJob(job.id);
    }, 700);
    timers.set(job.id, timer);
  }

  return job.id;
}

export async function processScoreJob(jobId: string) {
  timers.delete(jobId);

  try {
    await prisma.scoreJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    const job = await prisma.scoreJob.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        content: {
          include: {
            platform: true,
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              include: { score: true, fixes: true },
            },
          },
        },
      },
    });

    const latest = job.content.versions[0];
    const appliedTitles = latest?.fixes.filter((f) => f.applied).map((f) => f.title) ?? [];
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const scored = await runScorer({
      title: job.content.title,
      durationSec: job.content.durationSec,
      platform: job.content.platform?.provider,
      sourceUrl: job.content.sourceUrl,
      appliedFixTitles: appliedTitles,
    });

    const version = await prisma.contentVersion.create({
      data: {
        contentId: job.contentId,
        versionNumber: nextVersionNumber,
        score: {
          create: {
            overallScore: scored.overallScore,
            componentScores: scored.componentScores,
            componentNotes: scored.componentNotes,
            verdict: scored.verdict,
            predictedViewsLow: scored.predictedViewsLow,
            predictedViewsHigh: scored.predictedViewsHigh,
            confidencePct: scored.confidencePct,
            sampleSize: scored.sampleSize,
          },
        },
        fixes: {
          create: scored.fixes.map((f) => ({
            title: f.title,
            description: f.description,
            suggestionText: f.suggestionText,
            pointValue: f.pointValue,
            railSeverity: f.railSeverity,
            applied: f.applied,
            appliedAt: f.applied ? new Date() : null,
            pointsEarned: f.applied ? f.pointValue : null,
          })),
        },
        retentionCurve: {
          create: {
            curvePoints: scored.retentionCurve.curvePoints,
            riskMomentSec: scored.retentionCurve.riskMomentSec,
            riskNote: scored.retentionCurve.riskNote,
          },
        },
      },
    });

    await prisma.scoreJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        result: {
          contentVersionId: version.id,
          overallScore: scored.overallScore,
          versionNumber: nextVersionNumber,
          queue: queueBackend(),
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Score job failed";
    await prisma.scoreJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message },
    });
    throw err;
  }
}
