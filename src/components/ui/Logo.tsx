/** Wordmark: a ticked circle and "viralyz" in the wide display cut, as on the marketing site. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 14 14">
          <path
            d="M2.5 7.5l3 3 6-7"
            fill="none"
            stroke="var(--vz-bg)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-[21px] leading-none">viralyz</span>
    </span>
  );
}
