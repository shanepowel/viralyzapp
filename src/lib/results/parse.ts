const BOM = "﻿";
const TAG_PATTERN = /vz_[a-z0-9]{4}/i;

export type ParsedRow = {
  adName: string;
  impressions: number;
  clicks: number;
  spend: number;
  purchases: number | null;
  revenue: number | null;
};

export type RejectedRow = { line: number; reason: string };

export type ParseResult = { rows: ParsedRow[]; rejected: RejectedRow[] };

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/** RFC4180-ish: quoted fields, "" as an escaped quote, \r\n or \n line endings. */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Ad-export numbers only need comma-as-decimal-separator support (e.g.
 * "1,5" meaning 1.5, as some locales render Ads Manager exports), not
 * thousands-grouping — a trailing "%" is stripped so a percentage column
 * parses to its numeric value.
 */
function parseLocaleNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/%$/, "").replace(/,/g, ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function findColumn(header: string[], names: string[]): number {
  for (const name of names) {
    const idx = header.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function extractTag(adName: string): string | null {
  const match = adName.match(TAG_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Parses a Meta or TikTok ads-manager CSV export into rows keyed by ad
 * name (or, when present, the vz_ tag embedded in it) — rows sharing a
 * tag are summed rather than kept as separate ads, since ad managers can
 * export one row per delivery breakdown for the same underlying ad.
 */
export function parseExport(csv: string, platform: "meta" | "tiktok"): ParseResult {
  const lines = parseCsvLines(stripBom(csv)).filter((line) => !(line.length === 1 && line[0] === ""));
  if (lines.length === 0) return { rows: [], rejected: [] };

  const header = lines[0].map((h) => h.trim().toLowerCase());
  const nameCol = findColumn(header, platform === "meta" ? ["ad name"] : ["ad name", "campaign name"]);
  const impressionsCol = findColumn(header, ["impressions"]);
  const clicksCol = findColumn(header, ["clicks", "link clicks"]);
  const spendCol = findColumn(header, ["amount spent (usd)", "spend", "cost"]);
  const purchasesCol = findColumn(header, ["purchases", "results"]);
  const revenueCol = findColumn(header, ["purchases conversion value", "revenue", "conversion value"]);

  const rows: ParsedRow[] = [];
  const rejected: RejectedRow[] = [];
  const byKey = new Map<string, ParsedRow>();

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const lineNumber = i + 1; // 1-based; the header occupies line 1

    const adName = nameCol >= 0 ? raw[nameCol]?.trim() : undefined;
    if (!adName) {
      rejected.push({ line: lineNumber, reason: "Missing ad name" });
      continue;
    }

    const impressions = impressionsCol >= 0 ? parseLocaleNumber(raw[impressionsCol] ?? "") : null;
    const clicks = clicksCol >= 0 ? parseLocaleNumber(raw[clicksCol] ?? "") : null;
    const spend = spendCol >= 0 ? parseLocaleNumber(raw[spendCol] ?? "") : null;
    if (impressions == null || clicks == null || spend == null) {
      rejected.push({ line: lineNumber, reason: "Missing or unparsable impressions, clicks, or spend" });
      continue;
    }
    const purchases = purchasesCol >= 0 ? parseLocaleNumber(raw[purchasesCol] ?? "") : null;
    const revenue = revenueCol >= 0 ? parseLocaleNumber(raw[revenueCol] ?? "") : null;

    const key = extractTag(adName) ?? adName.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.spend += spend;
      if (purchases != null) existing.purchases = (existing.purchases ?? 0) + purchases;
      if (revenue != null) existing.revenue = (existing.revenue ?? 0) + revenue;
    } else {
      const row: ParsedRow = { adName, impressions, clicks, spend, purchases, revenue };
      byKey.set(key, row);
      rows.push(row);
    }
  }

  return { rows, rejected };
}

export type MatchedRow = ParsedRow & { creativeId: string };
export type UnmatchedRow = ParsedRow & { reason: string };

/**
 * Matches parsed rows to the importing user's own creatives by vz_ tag.
 * Scoping to the caller's creatives (via the creativeIdByTag map they
 * supply) happens at the call site — this never matches across users.
 */
export function matchRowsByTag(
  rows: ParsedRow[],
  creativeIdByTag: Map<string, string>,
): { matched: MatchedRow[]; unmatched: UnmatchedRow[] } {
  const matched: MatchedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  for (const row of rows) {
    const tag = extractTag(row.adName);
    if (!tag) {
      unmatched.push({ ...row, reason: "No vz_ tag found in ad name" });
      continue;
    }
    const creativeId = creativeIdByTag.get(tag);
    if (!creativeId) {
      unmatched.push({ ...row, reason: `Tag ${tag} does not match any of your creatives` });
      continue;
    }
    matched.push({ ...row, creativeId });
  }

  return { matched, unmatched };
}
