import { prisma } from "@/lib/prisma";
import { platformLabel } from "@/lib/score-bands";
import type {
  ComponentNotes,
  ComponentScores,
  ContentLatestResponse,
  CurvePoint,
} from "@/lib/types";

export async function getContentLatest(contentId: string): Promise<ContentLatestResponse> {
  const content = await prisma.content.findUniqueOrThrow({
    where: { id: contentId },
    include: {
      platform: true,
      user: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          score: true,
          fixes: { orderBy: [{ applied: "asc" }, { pointValue: "desc" }] },
          retentionCurve: true,
        },
      },
    },
  });

  const latest = content.versions[0];
  if (!latest?.score) {
    throw new Error("Content has no scored versions");
  }

  const prior = content.versions[1];
  const priorScore = prior?.score;

  return {
    content: {
      id: content.id,
      title: content.title,
      status: content.status,
      durationSec: content.durationSec,
      platform: platformLabel(content.platform?.provider),
      scheduledFor: content.scheduledFor?.toISOString() ?? null,
    },
    version: {
      id: latest.id,
      versionNumber: latest.versionNumber,
      createdAt: latest.createdAt.toISOString(),
    },
    priorVersion: priorScore
      ? {
          versionNumber: prior!.versionNumber,
          overallScore: priorScore.overallScore,
        }
      : null,
    score: {
      overallScore: latest.score.overallScore,
      verdict: latest.score.verdict,
      componentScores: latest.score.componentScores as ComponentScores,
      componentNotes: latest.score.componentNotes as ComponentNotes,
      predictedViewsLow: latest.score.predictedViewsLow,
      predictedViewsHigh: latest.score.predictedViewsHigh,
      confidencePct: latest.score.confidencePct,
      sampleSize: latest.score.sampleSize,
      computedAt: latest.score.computedAt.toISOString(),
    },
    fixes: latest.fixes.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      suggestionText: f.suggestionText,
      pointValue: f.pointValue,
      railSeverity: f.railSeverity,
      applied: f.applied,
      pointsEarned: f.pointsEarned,
    })),
    retentionCurve: latest.retentionCurve
      ? {
          curvePoints: latest.retentionCurve.curvePoints as CurvePoint[],
          riskMomentSec: latest.retentionCurve.riskMomentSec,
          riskNote: latest.retentionCurve.riskNote,
        }
      : null,
    user: {
      name: content.user.name,
      plan: content.user.plan,
    },
  };
}

export async function getDefaultContentId(): Promise<string | null> {
  const kitchen = await prisma.content.findFirst({
    where: { title: "Kitchen hacks pt.3" },
  });
  return kitchen?.id ?? null;
}
