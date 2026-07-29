import { hasScoringService } from "@/lib/env";
import { scoreContent, type ScoreInput, type ScoreOutput } from "@/lib/scorer";

/**
 * Model-serving boundary: call external ML when SCORING_SERVICE_URL is set,
 * otherwise use the deterministic local heuristic scorer.
 *
 * Expected remote contract:
 * POST {SCORING_SERVICE_URL}/v1/score
 * Authorization: Bearer {SCORING_SERVICE_TOKEN} (optional)
 * Body: ScoreInput JSON
 * Response: ScoreOutput JSON
 */
export async function runScorer(input: ScoreInput): Promise<ScoreOutput> {
  if (!hasScoringService()) {
    return scoreContent(input);
  }

  const base = process.env.SCORING_SERVICE_URL!.replace(/\/$/, "");
  const token = process.env.SCORING_SERVICE_TOKEN?.trim();
  const res = await fetch(`${base}/v1/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scoring service error (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as ScoreOutput;
  if (typeof json.overallScore !== "number" || !json.componentScores) {
    throw new Error("Scoring service returned an invalid payload");
  }
  return json;
}

export function scoringBackend() {
  return hasScoringService() ? "external" : "local";
}
