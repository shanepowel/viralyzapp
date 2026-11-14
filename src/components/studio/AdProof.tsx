import {
  PLACEMENT_RATIO,
  readProof,
  safeZonePct,
  verdictWords,
  type CreativeDTO,
  type Mark,
} from "@/components/studio/proof";

/**
 * The ad itself, drawn as a proof on a white sheet. With guides on, the
 * platform's safe zone is ruled in blue: blue never prints, it only shows
 * where the app's own buttons will sit on top of the ad.
 */
export function AdProof({
  creative,
  guides = false,
  marks = [],
  className = "",
}: {
  creative: CreativeDTO;
  guides?: boolean;
  /** Marks to draw on the ad, at the text they are about. */
  marks?: Mark[];
  className?: string;
}) {
  const layout = creative.checks[0]?.layout;
  const placed = layout ? marks.filter((m) => m.box) : [];
  const busy = creative.status === "pending" || creative.status === "generating";
  const zone = guides ? safeZonePct(creative.placement) : null;

  return (
    <div
      className={`relative w-full overflow-hidden border border-rule bg-card ${busy ? "vz-shimmer" : ""} ${className}`}
      style={{ aspectRatio: PLACEMENT_RATIO[creative.placement] ?? "1 / 1" }}
    >
      {creative.compositeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creative.compositeUrl}
          alt={creative.headline ?? "Generated ad"}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center p-3 text-center ${busy ? "" : "hatch"}`}>
          <span className={`font-mono text-[11px] uppercase tracking-[0.06em] ${busy ? "text-guide" : "bg-card px-1.5 text-muted"}`}>
            {creative.status === "pending"
              ? "Queued"
              : busy
                ? "Making"
                : creative.status === "failed"
                  ? "Not made. Credit returned"
                  : "No image stored"}
          </span>
        </div>
      )}
      {zone ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border border-dashed border-guide"
          style={{ top: `${zone.top}%`, right: `${zone.right}%`, bottom: `${zone.bottom}%`, left: `${zone.left}%` }}
        >
          <span className="absolute left-0 top-0 -translate-y-full bg-guide px-1 font-mono text-[9px] uppercase tracking-[0.06em] text-bg">
            Safe zone
          </span>
        </div>
      ) : null}
      {layout
        ? placed.map((m) => {
            const b = m.box!;
            return (
              <div
                key={m.factor.id}
                aria-hidden="true"
                className="pointer-events-none absolute border-2 border-mark"
                style={{
                  left: `${(b.x / layout.width) * 100}%`,
                  top: `${(b.y / layout.height) * 100}%`,
                  width: `${(b.w / layout.width) * 100}%`,
                  height: `${(b.h / layout.height) * 100}%`,
                }}
              >
                <span
                  className={`absolute -right-[11px] ${
                    // Keep the number on the ad when the box touches the top edge.
                    b.y / layout.height < 0.04 ? "-bottom-[11px]" : "-top-[11px]"
                  } inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-mark bg-card font-mono text-[11px] font-medium text-mark`}
                >
                  {m.n}
                </span>
              </div>
            );
          })
        : null}
    </div>
  );
}

/** One cell of a contact sheet: the proof, and its verdict in a single line under it. */
export function ProofTile({
  creative,
  selected = false,
  onSelect,
  caption,
}: {
  creative: CreativeDTO;
  selected?: boolean;
  onSelect: () => void;
  caption?: string;
}) {
  const proof = readProof(creative);
  const tone =
    proof.verdict === "cleared"
      ? "text-pass"
      : proof.verdict === "fix" || proof.verdict === "blocked"
        ? "text-mark"
        : proof.verdict === "checking"
          ? "text-guide"
          : "text-muted";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group block w-full cursor-pointer border-0 bg-transparent p-0 text-left ${selected ? "" : "opacity-95"}`}
    >
      <span className={`block p-1 ${selected ? "outline outline-2 outline-ink" : "outline outline-1 outline-transparent group-hover:outline-line"}`}>
        <AdProof creative={creative} />
      </span>
      <span className="mt-1.5 flex items-baseline justify-between gap-2 px-1">
        <span className={`font-mono text-[11px] font-medium uppercase tracking-[0.06em] ${tone}`}>
          {proof.verdict === "blocked" ? <span className="bg-mark px-1 text-bg">Blocked</span> : verdictWords(proof)}
        </span>
        <span className="truncate font-mono text-[11px] text-muted">{caption ?? creative.tag}</span>
      </span>
    </button>
  );
}
