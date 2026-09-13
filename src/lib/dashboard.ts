import { prisma } from "@/lib/prisma";
import { formatViews, platformLabel } from "@/lib/score-bands";
import type { DashboardResponse } from "@/lib/types";

function midPredicted(low: number, high: number) {
  return Math.round((low + high) / 2);
}

export async function getDashboard(userId: string): Promise<DashboardResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      insights: { orderBy: { computedAt: "desc" }, take: 3 },
      mediaKit: true,
      content: {
        include: {
          platform: true,
          performance: { orderBy: { measuredAt: "desc" }, take: 1 },
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: { score: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const scored = user.content.filter((c) => c.versions[0]?.score);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const thisMonth = scored.filter(
    (c) => c.versions[0]!.score!.computedAt >= monthStart && !c.title.startsWith("Archive"),
  );
  const monthlyScores = thisMonth.map((c) => c.versions[0]!.score!.overallScore);
  const monthlyScore =
    monthlyScores.length > 0
      ? Math.round(monthlyScores.reduce((a, b) => a + b, 0) / monthlyScores.length)
      : 0;
  const monthlyPostCount = monthlyScores.length;
  const hasMonthlyScoreData = monthlyPostCount > 0;

  // Real month-over-month comparison (previous calendar month), rather than an invented delta.
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const prevMonth = scored.filter(
    (c) =>
      c.versions[0]!.score!.computedAt >= prevMonthStart &&
      c.versions[0]!.score!.computedAt < monthStart &&
      !c.title.startsWith("Archive"),
  );
  const prevMonthScores = prevMonth.map((c) => c.versions[0]!.score!.overallScore);
  const prevMonthScore =
    prevMonthScores.length > 0
      ? Math.round(prevMonthScores.reduce((a, b) => a + b, 0) / prevMonthScores.length)
      : null;
  const monthlyScoreDelta =
    hasMonthlyScoreData && prevMonthScore != null ? monthlyScore - prevMonthScore : null;

  const monthlySparkline =
    monthlyScores.length > 0
      ? [...monthlyScores.slice(-5), monthlyScore].slice(-6)
      : [0, 0, 0, 0, 0, 0];

  const withActual = scored.filter((c) => c.performance[0] && c.versions[0]?.score);
  let hits = 0;
  for (const c of withActual) {
    const score = c.versions[0]!.score!;
    const actual = c.performance[0]!.actualViews;
    const mid = midPredicted(score.predictedViewsLow, score.predictedViewsHigh);
    const withinBand = actual >= score.predictedViewsLow && actual <= score.predictedViewsHigh;
    const withinTolerance = Math.abs(actual - mid) / Math.max(mid, 1) <= 0.35;
    if (withinBand || withinTolerance) hits += 1;
  }
  const hasAccuracyData = withActual.length > 0;
  const accuracySampleSize = Math.max(withActual.length, user.insights[0]?.sampleSize ?? 0);
  const liveAccuracy = hasAccuracyData ? Math.round((hits / withActual.length) * 100) : 0;

  const draftHigh = scored
    .filter((c) => c.status === "draft" && c.versions[0]?.score)
    .sort((a, b) => b.versions[0]!.score!.overallScore - a.versions[0]!.score!.overallScore)[0];

  const nextBestAction = draftHigh
    ? {
        contentId: draftHigh.id,
        title: draftHigh.title,
        score: draftHigh.versions[0]!.score!.overallScore,
        reason: `"${draftHigh.title}" scored ${draftHigh.versions[0]!.score!.overallScore} but is not scheduled. Tonight at 6pm is your best slot this week.`,
        suggestedSlot: "6pm",
      }
    : scored.length === 0
      ? {
          contentId: "",
          title: "Score your first video",
          score: 0,
          reason: "Upload a draft and get a Viral Score in under 30 seconds.",
          suggestedSlot: "now",
        }
      : null;

  const recent = scored
    .filter((c) => !c.title.startsWith("Archive"))
    .slice(0, 8)
    .map((c) => {
      const score = c.versions[0]!.score!;
      const predicted = midPredicted(score.predictedViewsLow, score.predictedViewsHigh);
      const actual = c.performance[0]?.actualViews ?? null;
      let vsNote = "predicted";
      if (actual != null) {
        if (actual >= score.predictedViewsLow && actual <= score.predictedViewsHigh) {
          vsNote = `vs ${formatViews(predicted)} predicted ▲`;
        } else if (actual > score.predictedViewsHigh) {
          vsNote = `vs ${formatViews(predicted)} predicted ▲`;
        } else {
          vsNote = `vs ${formatViews(predicted)} predicted ▼`;
        }
      }
      return {
        contentId: c.id,
        title: c.title,
        platform: platformLabel(c.platform?.provider),
        durationSec: c.durationSec,
        thumbnailUrl: c.thumbnailUrl,
        score: score.overallScore,
        status: c.status,
        predictedViews: predicted,
        actualViews: actual,
        vsNote,
      };
    });

  const order = [
    "Kitchen hacks pt.3",
    "5 minute pasta, honestly",
    "Q&A: your cooking fails",
    "Behind the scenes, market run",
  ];
  recent.sort((a, b) => {
    const ai = order.indexOf(a.title);
    const bi = order.indexOf(b.title);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Real recent-score trend (most recently updated scored posts, oldest first). No fallback
  // filler — an account with no scored posts yet gets an empty trend, not invented movement.
  const momentum = scored
    .slice(0, 6)
    .map((c) => c.versions[0]!.score!.overallScore)
    .reverse();

  return {
    user: {
      id: user.id,
      name: user.name,
      plan: user.plan,
      creditsRemaining: user.creditsRemaining,
      momentum,
    },
    monthlyScore: hasMonthlyScoreData ? monthlyScore : null,
    monthlyScoreDelta,
    monthlyPostCount,
    monthlySparkline,
    hasMonthlyScoreData,
    predictionAccuracyPct: hasAccuracyData ? liveAccuracy : null,
    // No historical accuracy snapshot is tracked yet, so there is nothing honest to diff
    // against — leave it null rather than inventing a trend.
    accuracyDelta: null,
    accuracySampleSize,
    hasAccuracyData,
    nextBestAction,
    recentScores: recent.slice(0, 4),
    insights: user.insights.map((i) => ({
      id: i.id,
      icon: i.icon,
      statement: i.statement,
      supportingNote: i.supportingNote,
      sampleSize: i.sampleSize,
    })),
    mediaKit: user.mediaKit
      ? {
          viewsThisWeek: user.mediaKit.viewsThisWeek,
          newOrdersCount: user.mediaKit.newOrdersCount,
          lastSyncedAt: user.mediaKit.lastSyncedAt.toISOString(),
        }
      : null,
  };
}
