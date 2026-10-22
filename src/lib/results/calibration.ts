const MIN_QUALIFYING_PAIRS = 20;
const MIN_IMPRESSIONS = 1000;

/** Average rank for tied values, 1-based — the standard tie-break for Spearman. */
function rankWithTies(values: number[]): number[] {
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array<number>(values.length).fill(0);

  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) j++;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k]] = averageRank;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation. Null for fewer than 3 points or zero variance in either series. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;

  const n = xs.length;
  const rx = rankWithTies(xs);
  const ry = rankWithTies(ys);
  const meanX = rx.reduce((a, b) => a + b, 0) / n;
  const meanY = ry.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX;
    const dy = ry[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

export type CalibrationPair = { score: number; impressions: number; clicks: number };

/**
 * Spearman correlation between headline score and CTR, restricted to pairs
 * with enough delivery to mean something (>= 1,000 impressions), and only
 * reported once there are enough of them (>= 20) — otherwise the N alone
 * is still shown, never a rho computed from too little data.
 */
export function calibrate(pairs: CalibrationPair[]): {
  n: number;
  rho: number | null;
  status: "ok" | "insufficient";
} {
  const qualifying = pairs.filter((p) => p.impressions >= MIN_IMPRESSIONS);
  if (qualifying.length < MIN_QUALIFYING_PAIRS) {
    return { n: qualifying.length, rho: null, status: "insufficient" };
  }

  const scores = qualifying.map((p) => p.score);
  const ctrs = qualifying.map((p) => (p.impressions > 0 ? p.clicks / p.impressions : 0));
  return { n: qualifying.length, rho: spearman(scores, ctrs), status: "ok" };
}

/**
 * One row per creative across every import: the row from the newest import
 * wins. Each import is treated as a full snapshot of an ad's results (how
 * Ads Manager and TikTok exports for a date range read), so re-importing a
 * later export for the same ads replaces their numbers instead of adding a
 * second "ad" to N. Rows with no creative are left out.
 */
export function latestRowPerCreative<T extends { creativeId: string | null; importedAt: Date }>(
  rows: T[],
): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (!row.creativeId) continue;
    const current = latest.get(row.creativeId);
    if (!current || row.importedAt.getTime() > current.importedAt.getTime()) {
      latest.set(row.creativeId, row);
    }
  }
  return [...latest.values()];
}
