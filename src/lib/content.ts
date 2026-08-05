import { prisma } from "@/lib/prisma";
import { platformLabel } from "@/lib/score-bands";
import type {
  ComponentResults,
  ContentLatestResponse,
  CurvePoint,
  FactorKey,
  FactorResult,
} from "@/lib/types";

const FACTOR_KEYS: FactorKey[] = ["opening", "visuals", "pacing", "words", "timing"];

// See src/lib/jobs.ts: the Score model's componentNotes Json column is
// repurposed to carry factor-availability metadata now that per-factor notes
// live inside componentResults (stored in the componentScores column).
type ScoreMeta = {
  factorsScored: number;
  factorsTotal: number;
  confidenceAvailable: boolean;
  viewsAvailable: boolean;
};

/**
 * Older scored versions (e.g. seed data) store componentScores/componentNotes
 * as flat {factor: number} / {factor: note} maps rather than the newer
 * ComponentResults shape. Read either shape so pre-existing rows keep
 * rendering instead of showing "undefined".
 */
function readComponentResults(scoresJson: unknown, notesJson: unknown): ComponentResults {
  const scores = (scoresJson ?? {}) as Record<string, unknown>;
  const legacyNotes = (notesJson ?? {}) as Record<string, unknown>;
  const out = {} as ComponentResults;
  for (const key of FACTOR_KEYS) {
    const raw = scores[key];
    if (raw && typeof raw === "object" && "status" in (raw as Record<string, unknown>)) {
      out[key] = raw as FactorResult;
    } else if (typeof raw === "number") {
      const note = typeof legacyNotes[key] === "string" ? (legacyNotes[key] as string) : "";
      out[key] = { status: "scored", value: raw, note };
    } else {
      out[key] = { status: "unavailable", reason: "Not scored" };
    }
  }
  return out;
}

function readScoreMeta(notesJson: unknown, componentResults: ComponentResults): ScoreMeta {
  const notes = notesJson as Partial<ScoreMeta> | null;
  if (notes && typeof notes.factorsScored === "number") {
    return {
      factorsScored: notes.factorsScored,
      factorsTotal: notes.factorsTotal ?? FACTOR_KEYS.length,
      confidenceAvailable: notes.confidenceAvailable ?? false,
      viewsAvailable: notes.viewsAvailable ?? false,
    };
  }
  // Legacy row: componentNotes is a flat notes map, not meta. These rows
  // predate the evidence gating and represent already-analyzed, posted
  // content, so the seeded predictedViews/confidence are treated as real.
  const factorsScored = FACTOR_KEYS.filter((k) => componentResults[k].status === "scored").length;
  return {
    factorsScored,
    factorsTotal: FACTOR_KEYS.length,
    confidenceAvailable: true,
    viewsAvailable: true,
  };
}

export async function getContentLatest(
  contentId: string,
  userId?: string,
): Promise<ContentLatestResponse> {
  const content = await prisma.content.findFirstOrThrow({
    where: userId ? { id: contentId, userId } : { id: contentId },
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

  const componentResults = readComponentResults(
    latest.score.componentScores,
    latest.score.componentNotes,
  );
  const scoreMeta = readScoreMeta(latest.score.componentNotes, componentResults);

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
      componentResults,
      factorsScored: scoreMeta.factorsScored,
      factorsTotal: scoreMeta.factorsTotal,
      predictedViewsLow: scoreMeta.viewsAvailable ? latest.score.predictedViewsLow : null,
      predictedViewsHigh: scoreMeta.viewsAvailable ? latest.score.predictedViewsHigh : null,
      confidencePct: scoreMeta.confidenceAvailable ? latest.score.confidencePct : null,
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
