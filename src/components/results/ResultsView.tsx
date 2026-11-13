"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";

/** Calibration needs this many matched ads before it shows a number (see HANDOFF constraints). */
const CALIBRATION_MIN = 20;

type ImportRow = {
  id: string;
  adName: string;
  impressions: number;
  clicks: number;
  matched: boolean;
  creativeId: string | null;
};

type ImportSummary = {
  rowsTotal: number;
  rowsMatched: number;
  rowsRejected: { line: number; reason: string }[];
  rows: ImportRow[];
};

type Calibration = { n: number; rho: number | null; status: "ok" | "insufficient" };

export type CreativeRow = ImportRow & { headline: number | null };

export type PastImport = {
  id: string;
  platform: string;
  filename: string;
  rowsTotal: number;
  rowsMatched: number;
  createdAt: string;
};

export function ResultsView({
  initialRows = [],
  pastImports = [],
}: {
  initialRows?: CreativeRow[];
  pastImports?: PastImport[];
}) {
  const [platform, setPlatform] = useState<"meta" | "tiktok">("meta");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [creativeRows, setCreativeRows] = useState<CreativeRow[]>(initialRows);
  const [calibration, setCalibration] = useState<Calibration | null>(null);

  async function loadCalibration() {
    const res = await fetch("/api/results/calibration");
    if (res.ok) setCalibration(await res.json());
  }

  useEffect(() => {
    async function run() {
      const res = await fetch("/api/results/calibration");
      if (res.ok) setCalibration(await res.json());
    }
    void run();
  }, []);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const csv = await file.text();
      const params = new URLSearchParams({ platform, filename: file.name });
      const res = await fetch(`/api/results/import?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csv,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Could not import this file.");
        return;
      }

      const importData = data.import as ImportSummary;
      setSummary(importData);

      const matchedRows = importData.rows.filter((r) => r.matched && r.creativeId);
      const withHeadline = await Promise.all(
        matchedRows.map(async (row): Promise<CreativeRow> => {
          const creativeRes = await fetch(`/api/studio/creatives/${row.creativeId}`);
          if (!creativeRes.ok) return { ...row, headline: null };
          const creativeData = await creativeRes.json();
          return { ...row, headline: creativeData.creative.checks[0]?.headline ?? null };
        }),
      );
      // The newest import replaces a variant's numbers, as in calibration.
      setCreativeRows((prev) => {
        const fresh = new Set(withHeadline.map((r) => r.creativeId));
        return [...withHeadline, ...prev.filter((r) => !fresh.has(r.creativeId))];
      });

      await loadCalibration();
    } catch {
      setUploadError("Could not import this file.");
    } finally {
      setUploading(false);
    }
  }

  const unmatchedCount = summary ? summary.rowsTotal - summary.rowsMatched - summary.rowsRejected.length : 0;
  const unmatchedRows = summary?.rows.filter((r) => !r.matched) ?? [];

  const calibrationN = calibration?.n ?? 0;
  const calibrationReady = calibration?.status === "ok" && calibration.rho != null;

  const have = Math.min(calibrationN, CALIBRATION_MIN);
  const th = "kicker border-b border-rule px-0 py-2 text-left font-medium";

  return (
    <div className="vfade">
      <PageHeader
        kicker="Results"
        title="Did the checks hold up with real spend?"
        description="Import an Ads Manager export. Rows are matched to your ads by the tag in the ad name."
      />

      <div className="grid grid-cols-1 gap-x-12 gap-y-8 border-t border-rule lg:grid-cols-2">
        <section aria-label="Import" className="flex flex-col gap-4 pt-5">
          <p className="kicker m-0 text-ink">Import an export</p>
          <Segmented
            label="Export source"
            value={platform}
            onChange={setPlatform}
            className="self-start"
            options={[
              { value: "meta", label: "Meta Ads Manager" },
              { value: "tiktok", label: "TikTok Ads Manager" },
            ]}
          />

          <label className="flex cursor-pointer flex-col gap-1 border border-dashed border-rule bg-card px-4 py-6 hover:bg-panel focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-guide">
            <span className="text-[15px] font-semibold text-ink">{file ? file.name : "Choose a CSV file"}</span>
            <span className="font-mono text-[12px] text-muted">
              {platform === "meta"
                ? "Ads Manager > Reports > Export table data (.csv)"
                : "Ads Manager > Export (.csv)"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>

          {uploadError && <Notice tone="error">{uploadError}</Notice>}

          <Button onClick={() => void upload()} disabled={!file || uploading} className="self-start">
            {uploading ? "Importing…" : "Import file"}
          </Button>
        </section>

        {/* No trend is drawn before there is enough matched spend to mean something. */}
        <section aria-label="Check score against click-through rate" className="flex flex-col gap-3 pt-5 lg:border-l lg:border-line lg:pl-12">
          <p className="kicker m-0 text-ink">Check score against click-through rate</p>
          {calibrationReady ? (
            <>
              <p className="font-display m-0 font-mono text-[56px] tracking-normal">{calibration!.rho!.toFixed(2)}</p>
              <p className="m-0 max-w-[460px] text-[14px] text-ink-2">
                Rank correlation across {calibration!.n} matched ads with at least 1,000 impressions each. 1 would mean
                the higher-scoring ad always got the better click-through rate; 0 means no link.
              </p>
            </>
          ) : (
            <>
              <p className="font-display m-0 text-[30px]">
                Not enough data yet.
                <span className="text-muted">
                  {" "}
                  {have} of {CALIBRATION_MIN} ads.
                </span>
              </p>
              <div
                className="grid gap-[3px]"
                style={{ gridTemplateColumns: `repeat(${CALIBRATION_MIN}, minmax(0, 1fr))` }}
                role="img"
                aria-label={`${have} of ${CALIBRATION_MIN} matched ads`}
              >
                {Array.from({ length: CALIBRATION_MIN }, (_, i) => (
                  <span key={i} className={`h-6 border ${i < have ? "border-ink bg-ink" : "hatch border-line"}`} />
                ))}
              </div>
              <p className="m-0 max-w-[460px] text-[14px] text-ink-2">
                A trend from fewer than {CALIBRATION_MIN} matched ads, each with 1,000 or more impressions, would be
                noise. We show the number when it means something, not before.
              </p>
            </>
          )}
        </section>
      </div>

      {summary && (
        <section aria-label="This import" className="mt-8 border-t border-rule">
          <dl className="m-0 grid grid-cols-2 sm:grid-cols-4">
            {(
              [
                ["Rows", summary.rowsTotal, ""],
                ["Matched", summary.rowsMatched, "text-pass"],
                ["No tag", unmatchedCount, unmatchedCount > 0 ? "text-mark" : ""],
                ["Rejected", summary.rowsRejected.length, summary.rowsRejected.length > 0 ? "text-mark" : ""],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="border-b border-line py-3">
                <dt className="kicker">{label}</dt>
                <dd className={`m-0 mt-1 font-mono text-[28px] font-medium ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {summary.rowsRejected.length > 0 && (
            <ul className="m-0 list-none p-0 pt-2">
              {summary.rowsRejected.map((r, i) => (
                <li key={i} className="margin-note py-0.5">
                  Line {r.line}: {r.reason}
                </li>
              ))}
            </ul>
          )}

          {unmatchedRows.length > 0 && (
            <p className="margin-note m-0 pt-2">
              No vz_ tag in the ad name, so these could not be matched: {unmatchedRows.map((r) => r.adName).join(", ")}
            </p>
          )}
        </section>
      )}

      {creativeRows.length > 0 && (
        <section aria-label="Matched ads" className="mt-10">
          <h2 className="font-display m-0 pb-3 text-[22px]">Matched ads</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-t border-rule text-[14px]">
              <thead>
                <tr>
                  <th className={th}>Ad name</th>
                  <th className={`${th} text-right`}>Check score</th>
                  <th className={`${th} text-right`}>CTR</th>
                  <th className={`${th} text-right`}>Impressions</th>
                </tr>
              </thead>
              <tbody>
                {creativeRows.map((row) => (
                  <tr key={row.id} className="border-b border-line hover:bg-panel">
                    <td className="py-2.5 pr-4">{row.adName}</td>
                    <td className="py-2.5 pl-4 text-right font-mono text-[13px]">{row.headline ?? "n/a"}</td>
                    <td className="py-2.5 pl-4 text-right font-mono text-[13px]">
                      {row.impressions > 0 ? `${((row.clicks / row.impressions) * 100).toFixed(2)}%` : "n/a"}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-mono text-[13px]">{row.impressions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {creativeRows.length === 0 && !summary ? (
        <div className="mt-10 grid grid-cols-1 gap-6 border-y border-rule py-8 md:grid-cols-[200px_1fr]">
          <p className="kicker m-0 text-ink">No matched ads yet</p>
          <ol className="m-0 max-w-[560px] list-none p-0 text-[14px] text-ink-2">
            <li className="border-b border-line py-2">
              <span className="font-mono text-muted">1 </span>Copy an ad&apos;s tag from Studio, like{" "}
              <span className="font-mono text-ink">vz_ab12</span>.
            </li>
            <li className="border-b border-line py-2">
              <span className="font-mono text-muted">2 </span>Put it in the ad name when you upload to Ads Manager.
            </li>
            <li className="py-2">
              <span className="font-mono text-muted">3 </span>Export the report as CSV and import it above.
            </li>
          </ol>
        </div>
      ) : null}

      {pastImports.length > 0 ? (
        <section aria-label="Recent imports" className="mt-10">
          <h2 className="kicker m-0 border-b border-rule pb-2 text-ink">Recent imports</h2>
          <ul className="m-0 list-none p-0">
            {pastImports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2.5 text-[14px]">
                <span className="min-w-0 truncate font-medium">{i.filename}</span>
                <span className="font-mono text-[12px] text-muted">
                  {i.platform === "meta" ? "Meta" : "TikTok"} / {i.rowsMatched} of {i.rowsTotal} matched /{" "}
                  {new Date(i.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
