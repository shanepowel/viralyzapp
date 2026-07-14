import type { ComponentNotes, ComponentScores, CurvePoint } from "@/lib/types";

export type ScoreInput = {
  title: string;
  durationSec: number;
  platform?: string | null;
  sourceUrl?: string | null;
  appliedFixTitles?: string[];
};

export type ScoreOutput = {
  overallScore: number;
  componentScores: ComponentScores;
  componentNotes: ComponentNotes;
  verdict: string;
  predictedViewsLow: number;
  predictedViewsHigh: number;
  confidencePct: number;
  sampleSize: number;
  fixes: Array<{
    title: string;
    description: string;
    suggestionText: string;
    pointValue: number;
    railSeverity: string;
    applied: boolean;
  }>;
  retentionCurve: {
    curvePoints: CurvePoint[];
    riskMomentSec: number | null;
    riskNote: string | null;
  };
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function scoreContent(input: ScoreInput): ScoreOutput {
  const h = hash(`${input.title}|${input.durationSec}|${input.platform ?? ""}`);
  const questionBonus = /\?|how|why|what|wrong|secret|honestly/i.test(input.title) ? 3 : 0;
  const durationIdeal =
    input.durationSec >= 35 && input.durationSec <= 60
      ? 2
      : input.durationSec > 120
        ? -2
        : 0;

  const opening = clamp(14 + (h % 6) + questionBonus, 8, 20);
  const visuals = clamp(13 + ((h >> 3) % 6), 8, 20);
  const pacing = clamp(12 + ((h >> 6) % 6) + durationIdeal, 7, 20);
  const words = clamp(13 + ((h >> 9) % 6) + (input.title.length > 12 ? 1 : 0), 8, 20);
  const timing = clamp(14 + ((h >> 12) % 5), 9, 20);

  const applied = new Set(input.appliedFixTitles ?? []);
  let openingAdj = opening;
  let pacingAdj = pacing;
  let wordsAdj = words;
  if (applied.has("Rewrite the first line") || applied.has("Lead with a question")) {
    openingAdj = clamp(openingAdj + 3, 0, 20);
  }
  if (applied.has("Trim the pause at 0:41") || applied.has("Cut the mid-video stall")) {
    pacingAdj = clamp(pacingAdj + 2, 0, 20);
  }
  if (applied.has("Tighten the caption")) {
    wordsAdj = clamp(wordsAdj + 1, 0, 20);
  }

  const componentScores: ComponentScores = {
    opening: openingAdj,
    visuals,
    pacing: pacingAdj,
    words: wordsAdj,
    timing,
  };

  const sum = Object.values(componentScores).reduce((a, b) => a + b, 0);
  const overallScore = clamp(Math.round((sum / 100) * 100), 1, 100);

  const componentNotes: ComponentNotes = {
    opening:
      openingAdj >= 17
        ? "Strong. The payoff lands in the first second."
        : "Payoff arrives late — lead with the result or a sharp question.",
    visuals:
      visuals >= 16
        ? "Bright, readable, a clear face. Works at feed size."
        : "First frame is busy. Simplify the thumbnail and opening shot.",
    pacing:
      pacingAdj >= 16
        ? "Cuts stay tight through the middle."
        : "One slow moment mid-video where the shot holds still.",
    words:
      wordsAdj >= 16
        ? "Caption and tags are solid. Good niche tag mix."
        : "Caption buries the tip. Lead with the takeaway.",
    timing:
      timing >= 16
        ? "Tonight at 6pm is your peak. Scheduled slot is good."
        : "Off-peak window. Shift toward your strongest slot.",
  };

  const verdict =
    overallScore >= 85
      ? "Ready to post. One small fix would make it great."
      : overallScore >= 70
        ? "Close. A couple of fixes will lift this into posting range."
        : "Needs work before posting — start with the opening.";

  const baseViews = 40000 + (h % 180000) + overallScore * 1200;
  const predictedViewsLow = Math.round(baseViews * 0.75);
  const predictedViewsHigh = Math.round(baseViews * 1.15);
  const confidencePct = clamp(62 + Math.floor(overallScore / 5), 55, 88);
  const sampleSize = 28 + (h % 20);

  const riskMomentSec = clamp(Math.floor(input.durationSec * 0.65), 8, input.durationSec - 2);
  const fixes = [
    {
      title: pacingAdj < 17 ? "Trim the pause at 0:41" : "Cut the mid-video stall",
      description: `The shot holds still around ${Math.floor(riskMomentSec / 60)}:${String(riskMomentSec % 60).padStart(2, "0")}. People start leaving here.`,
      suggestionText: "Cut two seconds earlier, or add a text overlay over the pause.",
      pointValue: 3,
      railSeverity: "med",
      applied: applied.has("Trim the pause at 0:41") || applied.has("Cut the mid-video stall"),
    },
    {
      title: openingAdj < 18 ? "Rewrite the first line" : "Lead with a question",
      description: "The first line does not promise the payoff fast enough.",
      suggestionText: `"${input.title.replace(/\.$/, "")} — here's the part nobody tells you."`,
      pointValue: 9,
      railSeverity: "high",
      applied: applied.has("Rewrite the first line") || applied.has("Lead with a question"),
    },
    {
      title: "Tighten the caption",
      description: "The caption can lead with the tip instead of context.",
      suggestionText: "Three short lines. Tip first. Proof second. CTA last.",
      pointValue: 4,
      railSeverity: "med",
      applied: applied.has("Tighten the caption"),
    },
  ].sort((a, b) => Number(a.applied) - Number(b.applied) || b.pointValue - a.pointValue);

  const steps = 6;
  const curvePoints: CurvePoint[] = Array.from({ length: steps }, (_, i) => {
    const t = Math.round((i / (steps - 1)) * input.durationSec);
    const drop = i >= 4 && pacingAdj < 17 ? 18 : 8;
    return { tSeconds: t, pctRemaining: clamp(100 - i * drop - (i > 3 ? 6 : 0), 35, 100) };
  });

  return {
    overallScore,
    componentScores,
    componentNotes,
    verdict,
    predictedViewsLow,
    predictedViewsHigh,
    confidencePct,
    sampleSize,
    fixes,
    retentionCurve: {
      curvePoints,
      riskMomentSec,
      riskNote: `Risk moment at ${Math.floor(riskMomentSec / 60)}:${String(riskMomentSec % 60).padStart(2, "0")}. The still shot loses people. The fix above deals with this.`,
    },
  };
}

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
    const score = scoreContent({ title: text, durationSec: 42, platform: "tiktok" });
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
