export type ScoreBand = "s90" | "s70" | "s50" | "s30";

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "s90";
  if (score >= 65) return "s70";
  if (score >= 45) return "s50";
  return "s30";
}

export function scoreColor(score: number): string {
  const band = scoreBand(score);
  switch (band) {
    case "s90":
      return "var(--s90)";
    case "s70":
      return "var(--s70)";
    case "s50":
      return "var(--s50)";
    case "s30":
      return "var(--s30)";
    default: {
      const _exhaustive: never = band;
      return _exhaustive;
    }
  }
}

export function componentColor(scoreOutOf20: number): string {
  return scoreColor((scoreOutOf20 / 20) * 100);
}

/** Ring stroke-dashoffset: circumference × (1 − score/100) */
export function ringDashOffset(score: number, circumference: number): number {
  return circumference * (1 - score / 100);
}

export function formatViews(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(0)}K`;
  }
  return String(n);
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function platformLabel(provider: string | null | undefined): string {
  switch (provider) {
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Reels";
    case "youtube":
      return "YouTube";
    case null:
    case undefined:
      return "Unknown";
    default:
      return provider;
  }
}

export function statusChip(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "draft":
      return { bg: "var(--tint)", color: "var(--ink-3)", label: "Draft" };
    case "scheduled":
      return { bg: "var(--violet-soft)", color: "var(--violet-deep)", label: "Scheduled" };
    case "tracking":
      return { bg: "var(--s50-soft)", color: "var(--s50)", label: "Tracking" };
    case "posted":
      return { bg: "var(--s90-soft)", color: "var(--s90)", label: "Posted" };
    default:
      return { bg: "var(--tint)", color: "var(--ink-3)", label: status };
  }
}

export function railColor(severity: string): string {
  switch (severity) {
    case "high":
      return "var(--s30)";
    case "med":
      return "var(--s50)";
    case "low":
      return "var(--s70)";
    default:
      return "var(--s50)";
  }
}
