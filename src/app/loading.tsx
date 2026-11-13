/** Shown while a page's data loads: blue guide lines where the content will sit. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-bg" aria-busy="true" aria-label="Loading">
      <div className="h-14 border-b border-rule" />
      <div className="mx-auto max-w-[1440px] px-4 pt-10 md:px-8">
        <div className="vz-shimmer h-3 w-24 border border-dashed border-guide" />
        <div className="vz-shimmer mt-4 h-10 w-[min(520px,80%)] border border-dashed border-guide" />
        <div className="vz-shimmer mt-10 h-[320px] border border-dashed border-guide" />
      </div>
    </div>
  );
}
