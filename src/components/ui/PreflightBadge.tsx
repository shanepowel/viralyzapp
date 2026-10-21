type Props = { headline: number | null; counted: number; total: number };

export function PreflightBadge({ headline, counted, total }: Props) {
  if (headline == null) {
    return (
      <span className="font-mono text-[11px] text-[var(--ink-3)] bg-[var(--tint)] rounded-full px-[11px] py-1 inline-block whitespace-nowrap">
        Not enough checks to score
      </span>
    );
  }

  const color = headline >= 80 ? "var(--s90)" : headline >= 50 ? "var(--s50)" : "var(--s30)";
  const background = headline >= 80 ? "var(--s90-soft)" : headline >= 50 ? "var(--s50-soft)" : "var(--s30-soft)";

  return (
    <span
      className="font-mono text-[11px] font-semibold rounded-full px-[11px] py-1 inline-block whitespace-nowrap"
      style={{ color, background }}
    >
      Pre-flight {headline} · {counted} of {total} checks
    </span>
  );
}
