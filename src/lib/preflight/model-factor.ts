import { hasAnthropic } from "@/lib/env";
import type { FactorResult } from "@/lib/preflight/types";

const DEFAULT_MODEL = "claude-sonnet-5-5";
const PASS_THRESHOLD = 70;

const RUBRIC =
  "Rate this ad headline's hook clarity from 0 to 100 against this rubric: " +
  "does it state a clear, specific benefit or angle (not vague); is it " +
  "immediately understandable without the rest of the ad; does it create " +
  "genuine interest without being empty clickbait. " +
  'Respond with JSON only, no prose: {"score": number, "reason": string}.';

function parseScore(text: string): { score: number; reason: string } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  try {
    const parsed = JSON.parse((fenced ? fenced[1] : text).trim()) as Record<string, unknown>;
    if (typeof parsed.score !== "number" || !Number.isFinite(parsed.score)) return null;
    return {
      score: Math.min(100, Math.max(0, parsed.score)),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return null;
  }
}

function unavailable(model: string): FactorResult {
  return {
    id: "hook_clarity",
    label: "Hook clarity (AI-assessed)",
    kind: "model",
    status: "unavailable",
    evidence: `No model available (${model}).`,
  };
}

/**
 * Scores headline hook clarity against a fixed rubric. A model factor —
 * never counted toward the headline number (see aggregate.ts) until
 * calibration justifies including it.
 */
export async function assessHook(copy: { headline: string }): Promise<FactorResult> {
  if (!hasAnthropic()) return unavailable("unconfigured");
  if (!copy.headline.trim()) return unavailable("unconfigured");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: `${RUBRIC}\n\nHeadline: "${copy.headline}"` }],
      }),
    });
    if (!res.ok) return unavailable(DEFAULT_MODEL);

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const textBlock = data.content?.find((block) => block.type === "text")?.text;
    if (!textBlock) return unavailable(DEFAULT_MODEL);

    const parsed = parseScore(textBlock);
    if (!parsed) return unavailable(DEFAULT_MODEL);

    return {
      id: "hook_clarity",
      label: "Hook clarity (AI-assessed)",
      kind: "model",
      status: "scored",
      value: parsed.score,
      passed: parsed.score >= PASS_THRESHOLD,
      evidence: parsed.reason || `Scored ${parsed.score}/100 against the hook-clarity rubric.`,
      source: DEFAULT_MODEL,
    };
  } catch {
    return unavailable(DEFAULT_MODEL);
  }
}
