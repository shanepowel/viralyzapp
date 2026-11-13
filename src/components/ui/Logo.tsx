/**
 * The mark is a proof box with the green tick that means "cleared", next to
 * the wordmark in Schibsted Grotesk 800.
 */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
      <span
        className="inline-flex h-[20px] w-[20px] items-center justify-center border-[1.5px] border-ink"
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 14 14">
          <path d="M2 7.5l3.2 3.2L12 3.5" fill="none" stroke="var(--vz-pass)" strokeWidth="2.4" strokeLinecap="square" />
        </svg>
      </span>
      {compact ? null : <span className="font-display text-[19px]">viralyz</span>}
    </span>
  );
}
