import { prisma } from "@/lib/prisma";
import type { ComponentScores } from "@/lib/types";

type JobStore = Map<string, NodeJS.Timeout>;

const globalForJobs = globalThis as unknown as {
  viralyzJobTimers: JobStore | undefined;
};

const timers: JobStore = globalForJobs.viralyzJobTimers ?? new Map();
if (process.env.NODE_ENV !== "production") {
  globalForJobs.viralyzJobTimers = timers;
}

function bumpScore(base: number, appliedPoints: number): number {
  return Math.min(100, base + appliedPoints);
}

export async function enqueueScoreJob(contentId: string): Promise<string> {
  const job = await prisma.scoreJob.create({
    data: { contentId, status: "queued" },
  });

  const timer = setTimeout(() => {
    void runScoreJob(job.id);
  }, 600);
  timers.set(job.id, timer);

  return job.id;
}

async function runScoreJob(jobId: string) {
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
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              include: { score: true, fixes: true, retentionCurve: true },
            },
          },
        },
      },
    });

    const latest = job.content.versions[0];
    if (!latest?.score) {
      throw new Error("No prior score to re-score from");
    }

    const appliedPoints = latest.fixes
      .filter((f) => f.applied)
      .reduce((sum, f) => sum + (f.pointsEarned ?? f.pointValue), 0);

    const nextVersionNumber = latest.versionNumber + 1;
    const newOverall = bumpScore(latest.score.overallScore, Math.min(3, appliedPoints > 0 ? 2 : 0));

    const prevComponents = latest.score.componentScores as ComponentScores;
    const nextComponents: ComponentScores = {
      opening: prevComponents.opening,
      visuals: prevComponents.visuals,
      pacing: Math.min(20, prevComponents.pacing + (latest.fixes.some((f) => f.applied && f.title.includes("pause")) ? 2 : 0)),
      words: prevComponents.words,
      timing: prevComponents.timing,
    };

    const version = await prisma.contentVersion.create({
      data: {
        contentId: job.contentId,
        versionNumber: nextVersionNumber,
        score: {
          create: {
            overallScore: newOverall,
            componentScores: nextComponents,
            componentNotes: latest.score.componentNotes as object,
            verdict:
              newOverall >= 85
                ? "Ready to post. One small fix would make it great."
                : "Close. A couple of fixes will lift this into posting range.",
            predictedViewsLow: latest.score.predictedViewsLow,
            predictedViewsHigh: latest.score.predictedViewsHigh,
            confidencePct: latest.score.confidencePct,
            sampleSize: latest.score.sampleSize,
          },
        },
        fixes: {
          create: latest.fixes.map((f) => ({
            title: f.title,
            description: f.description,
            suggestionText: f.suggestionText,
            pointValue: f.pointValue,
            railSeverity: f.railSeverity,
            applied: f.applied,
            appliedAt: f.appliedAt,
            pointsEarned: f.applied ? f.pointValue : null,
          })),
        },
        retentionCurve: latest.retentionCurve
          ? {
              create: {
                curvePoints: latest.retentionCurve.curvePoints as object,
                riskMomentSec: latest.retentionCurve.riskMomentSec,
                riskNote: latest.retentionCurve.riskNote,
              },
            }
          : undefined,
      },
    });

    await prisma.scoreJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        result: { contentVersionId: version.id, overallScore: newOverall },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Score job failed";
    await prisma.scoreJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message },
    });
  }
}
