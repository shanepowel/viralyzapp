export type ComponentScores = {
  opening: number;
  visuals: number;
  pacing: number;
  words: number;
  timing: number;
};

export type ComponentNotes = {
  opening: string;
  visuals: string;
  pacing: string;
  words: string;
  timing: string;
};

export type CurvePoint = {
  tSeconds: number;
  pctRemaining: number;
};

export type DashboardResponse = {
  user: {
    id: string;
    name: string;
    plan: string;
    creditsRemaining?: number;
    momentum: number[];
  };
  monthlyScore: number;
  monthlyScoreDelta: number;
  monthlyPostCount: number;
  monthlySparkline: number[];
  predictionAccuracyPct: number;
  accuracyDelta: number;
  accuracySampleSize: number;
  nextBestAction: {
    contentId: string;
    title: string;
    score: number;
    reason: string;
    suggestedSlot: string;
  } | null;
  recentScores: Array<{
    contentId: string;
    title: string;
    platform: string;
    durationSec: number;
    thumbnailUrl: string | null;
    score: number;
    status: string;
    predictedViews: number;
    actualViews: number | null;
    vsNote: string;
  }>;
  insights: Array<{
    id: string;
    icon: string;
    statement: string;
    supportingNote: string;
    sampleSize: number;
  }>;
  mediaKit: {
    viewsThisWeek: number;
    newOrdersCount: number;
    lastSyncedAt: string;
  } | null;
};

export type ContentLatestResponse = {
  content: {
    id: string;
    title: string;
    status: string;
    durationSec: number;
    platform: string;
    scheduledFor: string | null;
  };
  version: {
    id: string;
    versionNumber: number;
    createdAt: string;
  };
  priorVersion: {
    versionNumber: number;
    overallScore: number;
  } | null;
  score: {
    overallScore: number;
    verdict: string;
    componentScores: ComponentScores;
    componentNotes: ComponentNotes;
    predictedViewsLow: number;
    predictedViewsHigh: number;
    confidencePct: number;
    sampleSize: number;
    computedAt: string;
  };
  fixes: Array<{
    id: string;
    title: string;
    description: string;
    suggestionText: string;
    pointValue: number;
    railSeverity: string;
    applied: boolean;
    pointsEarned: number | null;
  }>;
  retentionCurve: {
    curvePoints: CurvePoint[];
    riskMomentSec: number | null;
    riskNote: string | null;
  } | null;
  user: {
    name: string;
    plan: string;
  };
};
