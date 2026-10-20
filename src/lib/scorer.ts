import type { ComponentResults, CurvePoint, FactorKey, FactorResult } from "@/lib/types";

/**
 * What we actually know about this piece of content. Every claim the scorer
 * makes must trace back to one of these fields — no claim without a
 * measurement. See governing rule in the security-hardening audit.
 */
export type Evidence = {
  /** A video file was uploaded. */
  hasMedia: boolean;
  /** A resolvable platform URL was supplied. */
  hasSourceUrl: boolean;
  /** The creator has posts with real performance data. */
  hasCreatorHistory: boolean;
  /** How many of the creator's posts have real performance data. */
  historyPostCount: number;
  /** Average actual views across the creator's tracked posts, if any. */
  avgHistoricalViews?: number | null;
};

export type ScoreInput = {
  title: string;
  durationSec: number;
  platform?: string | null;
  sourceUrl?: string | null;
  appliedFixTitles?: string[];
  evidence: Evidence;
};

export type ScoreOutput = {
  overallScore: number;
  componentResults: ComponentResults;
  /** How many of the five factors actually got scored, out of factorsTotal. */
  factorsScored: number;
  factorsTotal: number;
  verdict: string;
  // These are only ever non-null when there is real history to derive them from.
  predictedViewsLow: number | null;
  predictedViewsHigh: number | null;
  confidencePct: number | null;
  sampleSize: number;
  fixes: Array<{
    title: string;
    description: string;
    suggestionText: string;
    pointValue: number;
    railSeverity: string;
    applied: boolean;
  }>;
  // null when there is no media to base a watch-retention estimate on at all —
  // a curve for a video that was never uploaded is fabrication, not analysis.
  retentionCurve: {
    curvePoints: CurvePoint[];
    riskMomentSec: number | null;
    riskNote: string | null;
  } | null;
};

const FACTOR_KEYS: FactorKey[] = ["opening", "visuals", "pacing", "words", "timing"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Text-based factors. These are the only two factors we can ever score from a
// bare title/caption — real textual features, not a hash of the string.
// ---------------------------------------------------------------------------

function scoreOpening(title: string): FactorResult {
  const trimmed = title.trim();
  const isQuestion =
    /\?\s*$/.test(trimmed) || /^(how|why|what|when|should|can|is|are|do|does|the secret)\b/i.test(trimmed);
  const hasNumber = /\d/.test(trimmed);
  const concise = trimmed.length > 0 && trimmed.length <= 60;
  const veryLong = trimmed.length > 90;

  let value = 10;
  if (isQuestion) value += 4;
  if (hasNumber) value += 3;
  if (concise) value += 3;
  if (veryLong) value -= 4;
  value = clamp(value, 0, 20);

  const reasons: string[] = [];
  if (isQuestion) reasons.push("poses a question or a direct promise up front");
  if (hasNumber) reasons.push("leads with a specific number");
  if (concise) reasons.push("is short enough to land fast");
  if (veryLong) reasons.push("runs long, which risks burying the payoff");

  const note =
    reasons.length > 0
      ? `Title ${reasons.join(", ")}.`
      : "Title is plain text — no question, number, or hook detected.";

  return { status: "scored", value, note };
}

function scoreWords(title: string): FactorResult {
  const trimmed = title.trim();
  const len = trimmed.length;
  const hasCta = /\b(save|comment|follow|tip|watch|share|try|learn)\b/i.test(trimmed);
  const wellSized = len >= 15 && len <= 70;
  const tooShort = len > 0 && len < 8;
  const tooLong = len > 120;

  let value = 10;
  if (wellSized) value += 4;
  if (hasCta) value += 3;
  if (tooShort) value -= 3;
  if (tooLong) value -= 3;
  value = clamp(value, 0, 20);

  const reasons: string[] = [];
  if (wellSized) reasons.push("a solid caption length");
  if (hasCta) reasons.push("a clear action word");
  if (tooShort) reasons.push("too short to carry a tip");
  if (tooLong) reasons.push("long enough to bury the point");

  const note =
    reasons.length > 0
      ? `Caption has ${reasons.join(" and ")}.`
      : `Caption is ${len} character${len === 1 ? "" : "s"} — no strong signal either way.`;

  return { status: "scored", value, note };
}

// ---------------------------------------------------------------------------
// Media-gated factors. We do not run frame extraction or a vision model
// (that is a separate, multi-week project) — so even once media exists, we
// only ever score a duration/format-based proxy, and we say so explicitly.
// ---------------------------------------------------------------------------

function scoreVisuals(durationSec: number, hasMedia: boolean): FactorResult {
  if (!hasMedia) {
    return { status: "unavailable", reason: "Upload the video to score visuals" };
  }
  const idealShort = durationSec >= 15 && durationSec <= 60;
  const value = clamp(idealShort ? 15 : 12, 0, 20);
  const note = idealShort
    ? `Video received (${durationSec}s). Length fits the range that reads well at feed size.`
    : `Video received (${durationSec}s). Shot-by-shot visual analysis isn't available yet — this reflects length only.`;
  return { status: "scored", value, note };
}

function scorePacing(durationSec: number, hasMedia: boolean): FactorResult {
  if (!hasMedia) {
    return { status: "unavailable", reason: "Upload the video to score pacing" };
  }
  const idealLength = durationSec >= 21 && durationSec <= 59;
  const long = durationSec > 120;
  let value = 12;
  if (idealLength) value += 4;
  if (long) value -= 3;
  value = clamp(value, 0, 20);
  const note = idealLength
    ? `${durationSec}s runs within the range that tends to hold attention.`
    : long
      ? `${durationSec}s is long for short-form — more room for a mid-video lull.`
      : `${durationSec}s — no strong pacing signal from length alone.`;
  return { status: "scored", value, note };
}

// ---------------------------------------------------------------------------
// History-gated factor.
// ---------------------------------------------------------------------------

function scoreTiming(evidence: Evidence): FactorResult {
  if (!evidence.hasCreatorHistory) {
    return { status: "unavailable", reason: "Connect a platform to score posting time" };
  }
  const count = evidence.historyPostCount;
  const value = clamp(10 + Math.min(count, 10), 0, 20);
  return {
    status: "scored",
    value,
    note: `Based on ${count} tracked post${count === 1 ? "" : "s"} from your connected platform.`,
  };
}

function bump(result: FactorResult, delta: number): FactorResult {
  if (result.status !== "scored") return result;
  return { ...result, value: clamp(result.value + delta, 0, 20) };
}

export function scoreContent(input: ScoreInput): ScoreOutput {
  const { evidence } = input;
  const applied = new Set(input.appliedFixTitles ?? []);

  const opening0 = scoreOpening(input.title);
  const words0 = scoreWords(input.title);
  const visuals = scoreVisuals(input.durationSec, evidence.hasMedia);
  const pacing0 = scorePacing(input.durationSec, evidence.hasMedia);
  const timing = scoreTiming(evidence);

  // Applied-fix bonuses only ever touch a factor that was actually scored.
  const openingAdj = applied.has("Rewrite the opening line") ? bump(opening0, 3) : opening0;
  const pacingAdj = applied.has("Address the pacing dip") ? bump(pacing0, 2) : pacing0;
  const wordsAdj = applied.has("Tighten the caption") ? bump(words0, 1) : words0;

  const componentResults: ComponentResults = {
    opening: openingAdj,
    visuals,
    pacing: pacingAdj,
    words: wordsAdj,
    timing,
  };

  const scoredKeys = FACTOR_KEYS.filter((k) => componentResults[k].status === "scored");
  const factorsScored = scoredKeys.length;
  const factorsTotal = FACTOR_KEYS.length;

  const overallScore =
    factorsScored > 0
      ? clamp(
          Math.round(
            (scoredKeys.reduce((sum, k) => {
              const r = componentResults[k];
              return sum + (r.status === "scored" ? r.value : 0);
            }, 0) /
              (factorsScored * 20)) *
              100,
          ),
          1,
          100,
        )
      : 0;

  const verdict =
    factorsScored === 0
      ? "Not enough to score yet — upload a video, paste a link, or connect a platform."
      : overallScore >= 85
        ? "Ready to post. One small fix would make it great."
        : overallScore >= 70
          ? "Close. A couple of fixes will lift this into posting range."
          : "Needs work before posting — start with the opening.";

  // Confidence is derived from how much real history exists, not asserted.
  const confidencePct = evidence.hasCreatorHistory
    ? clamp(30 + evidence.historyPostCount * 4, 30, 85)
    : null;
  const sampleSize = evidence.historyPostCount;

  const canPredictViews =
    evidence.hasCreatorHistory &&
    evidence.historyPostCount >= 10 &&
    typeof evidence.avgHistoricalViews === "number" &&
    evidence.avgHistoricalViews > 0;

  const predictedViewsLow = canPredictViews
    ? Math.round(evidence.avgHistoricalViews! * 0.7)
    : null;
  const predictedViewsHigh = canPredictViews
    ? Math.round(evidence.avgHistoricalViews! * 1.3)
    : null;

  const fixes: ScoreOutput["fixes"] = [];

  if (openingAdj.status === "scored" && openingAdj.value < 18) {
    fixes.push({
      title: "Rewrite the opening line",
      description: openingAdj.note,
      suggestionText: `"${input.title.replace(/\.$/, "")} — here's the part nobody tells you."`,
      pointValue: 9,
      railSeverity: "high",
      applied: applied.has("Rewrite the opening line"),
    });
  }

  if (wordsAdj.status === "scored" && wordsAdj.value < 16) {
    fixes.push({
      title: "Tighten the caption",
      description: wordsAdj.note,
      suggestionText: "Three short lines. Tip first. Proof second. CTA last.",
      pointValue: 4,
      railSeverity: "med",
      applied: applied.has("Tighten the caption"),
    });
  }

  // A timecode or shot reference is only ever honest once real media exists —
  // and even then it's a length-based estimate, not an observation of frames.
  let retentionCurve: ScoreOutput["retentionCurve"] = null;
  if (evidence.hasMedia && pacingAdj.status === "scored") {
    const steps = 6;
    const riskMomentSec = clamp(
      Math.floor(input.durationSec * 0.65),
      8,
      Math.max(input.durationSec - 2, 8),
    );
    const curvePoints: CurvePoint[] = Array.from({ length: steps }, (_, i) => {
      const t = Math.round((i / (steps - 1)) * input.durationSec);
      const drop = i >= 4 && pacingAdj.value < 17 ? 18 : 8;
      return { tSeconds: t, pctRemaining: clamp(100 - i * drop - (i > 3 ? 6 : 0), 35, 100) };
    });
    const timeLabel = `${Math.floor(riskMomentSec / 60)}:${String(riskMomentSec % 60).padStart(2, "0")}`;

    retentionCurve = {
      curvePoints,
      riskMomentSec,
      riskNote: `Videos around this length often see a dip near ${timeLabel} — this is a length-based estimate, not a measurement of your footage.`,
    };

    if (pacingAdj.value < 17) {
      fixes.push({
        title: "Address the pacing dip",
        description: `Videos this length often lose viewers near ${timeLabel}.`,
        suggestionText: "Cut a beat earlier there, or add a text overlay to hold attention.",
        pointValue: 3,
        railSeverity: "med",
        applied: applied.has("Address the pacing dip"),
      });
    }
  }

  fixes.sort((a, b) => Number(a.applied) - Number(b.applied) || b.pointValue - a.pointValue);

  return {
    overallScore,
    componentResults,
    factorsScored,
    factorsTotal,
    verdict,
    predictedViewsLow,
    predictedViewsHigh,
    confidencePct,
    sampleSize,
    fixes,
    retentionCurve,
  };
}

const NO_EVIDENCE: Evidence = {
  hasMedia: false,
  hasSourceUrl: false,
  hasCreatorHistory: false,
  historyPostCount: 0,
};

export function generateHooks(idea: string) {
  const seeds = [
    `I was wrong about ${idea}.`,
    `Stop doing ${idea} like this.`,
    `The ${idea} tip nobody says out loud.`,
    `Honestly? ${idea} took me years.`,
    `3 mistakes with ${idea} (number 2 hurts).`,
    `Watch this before your next ${idea}.`,
    `Why your ${idea} is failing in the first 2 seconds.`,
    `${idea} — but make it actually work.`,
    `I tested ${idea} for 30 days.`,
    `The lazy way to nail ${idea}.`,
  ];
  return seeds.map((text, i) => {
    const score = scoreContent({ title: text, durationSec: 42, platform: "tiktok", evidence: NO_EVIDENCE });
    return { id: `hook-${i}`, text, score: clamp(score.overallScore - (i % 3), 55, 96) };
  });
}

export function analyzeScript(script: string) {
  const lines = script
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line, i) => {
    const weak = line.length > 90 || /um|basically|just/i.test(line);
    return {
      line: i + 1,
      text: line,
      note: weak
        ? "Tighten this line — cut filler and lead with the action."
        : "Clear enough. Keep the pacing punchy when you read it.",
      delta: weak ? -2 : 1,
    };
  });
}

export function generateCaptions(topic: string) {
  return [
    {
      text: `${topic}. Save this before you forget.\n\n#creator #tips`,
      score: 84,
    },
    {
      text: `I wish someone told me this about ${topic} sooner.`,
      score: 88,
    },
    {
      text: `Hot take on ${topic} — the boring version works better.`,
      score: 79,
    },
    {
      text: `${topic} in 3 steps. No fluff.`,
      score: 91,
    },
  ];
}
