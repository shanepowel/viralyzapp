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

    // Evidence: what do we actually know, versus what would be a fabricated claim?
    const historyAgg = await prisma.actualPerformance.aggregate({
      where: { content: { userId: job.content.userId } },
      _avg: { actualViews: true },
      _count: { _all: true },
    });
    const historyPostCount = historyAgg._count._all;

    const scored = await runScorer({
      title: job.content.title,
      durationSec: job.content.durationSec,
      platform: job.content.platform?.provider,
      sourceUrl: job.content.sourceUrl,
      appliedFixTitles: appliedTitles,
      evidence: {
        hasMedia: Boolean(job.content.mediaUrl),
        hasSourceUrl: Boolean(job.content.sourceUrl),
        hasCreatorHistory: historyPostCount > 0,
        historyPostCount,
        avgHistoricalViews: historyAgg._avg.actualViews ?? null,
      },
    });

    // The Score model's predictedViews*/confidencePct columns are NOT NULL ints
    // (dashboard.ts reads them as plain numbers) — we do not widen that schema.
    // Instead we store an honest sentinel (0) when the scorer had no basis for a
    // number, and carry the real availability alongside in componentNotes so the
    // API layer (src/lib/content.ts) can present null to the UI instead of a
    // number that looks like a measurement.
    const scoreMeta = {
      factorsScored: scored.factorsScored,
      factorsTotal: scored.factorsTotal,
      confidenceAvailable: scored.confidencePct !== null,
      viewsAvailable: scored.predictedViewsLow !== null && scored.predictedViewsHigh !== null,
    };

    const version = await prisma.contentVersion.create({
      data: {
        contentId: job.contentId,
        versionNumber: nextVersionNumber,
        score: {
          create: {
            overallScore: scored.overallScore,
            componentScores: scored.componentResults,
            componentNotes: scoreMeta,
            verdict: scored.verdict,
            predictedViewsLow: scored.predictedViewsLow ?? 0,
            predictedViewsHigh: scored.predictedViewsHigh ?? 0,
            confidencePct: scored.confidencePct ?? 0,
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
        ...(scored.retentionCurve
          ? {
              retentionCurve: {
                create: {
                  curvePoints: scored.retentionCurve.curvePoints,
                  riskMomentSec: scored.retentionCurve.riskMomentSec,
                  riskNote: scored.retentionCurve.riskNote,
                },
              },
            }
          : {}),
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
