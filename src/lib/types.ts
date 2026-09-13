// Superseded by ComponentResults below (a factor can now be genuinely
// "unavailable" instead of always carrying a fabricated number). Left in
// place, unused, in case anything still imports the old flat shape.
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

// The five scoring factors. Each one is either "scored" (with a real basis
// for the value) or "unavailable" (with a reason we didn't score it) — a
// factor is never both unscored and numeric at once. See src/lib/scorer.ts.
export type FactorKey = "opening" | "visuals" | "pacing" | "words" | "timing";

export type FactorResult =
  | { status: "scored"; value: number; note: string }
  | { status: "unavailable"; reason: string };

export type ComponentResults = Record<FactorKey, FactorResult>;

export type DashboardResponse = {
  user: {
    id: string;
    name: string;
    plan: string;
    creditsRemaining?: number;
    momentum: number[];
  };
  monthlyScore: number | null;
  monthlyScoreDelta: number | null;
  monthlyPostCount: number;
  monthlySparkline: number[];
  hasMonthlyScoreData: boolean;
  predictionAccuracyPct: number | null;
  accuracyDelta: number | null;
  accuracySampleSize: number;
  hasAccuracyData: boolean;
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
    // Rich per-factor results — replaces the old flat componentScores/componentNotes
    // maps so a factor can be represented as genuinely "unavailable" instead of a
    // fabricated number. See ComponentResults in this file / src/lib/scorer.ts.
    componentResults: ComponentResults;
    factorsScored: number;
    factorsTotal: number;
    // null when there isn't enough real evidence to back a claim (see scorer.ts).
    predictedViewsLow: number | null;
    predictedViewsHigh: number | null;
    confidencePct: number | null;
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
