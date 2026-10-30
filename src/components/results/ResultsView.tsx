"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

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

  return (
    <div className="vfade">
      <PageHeader
        title="Results"
        description="Import a Meta or TikTok Ads Manager export. Rows are matched to your variants by the tag in the ad name, so you can see whether the checks held up with real spend."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 mb-6">
        <Panel>
          <div className="p-5 flex flex-col gap-4">
            <div role="radiogroup" aria-label="Export source" className="flex flex-wrap gap-1 self-start rounded-full bg-panel p-1">
              {(["meta", "tiktok"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={platform === p}
                  onClick={() => setPlatform(p)}
                  className={`min-h-8 rounded-full px-3.5 text-[13px] font-semibold border-none cursor-pointer ${
                    platform === p ? "bg-card text-ink shadow-float" : "bg-transparent text-muted hover:text-ink"
                  }`}
                >
                  {p === "meta" ? "Meta Ads Manager" : "TikTok Ads Manager"}
                </button>
              ))}
            </div>

            <label className="flex flex-col items-center justify-center gap-2 rounded-inner border border-dashed border-line-strong bg-panel dots px-4 py-8 text-center cursor-pointer hover:border-muted">
              <Upload className="h-5 w-5 text-muted" aria-hidden="true" />
              <span className="text-[14px] font-semibold text-ink">{file ? file.name : "Choose a CSV export"}</span>
              <span className="text-[12px] text-muted">
                {platform === "meta" ? "Ads Manager → Reports → Export table data (.csv)" : "Ads Manager → Export (.csv)"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>

            {uploadError && <Notice tone="error">{uploadError}</Notice>}

            <Button onClick={() => void upload()} disabled={!file || uploading}>
              {uploading ? "Importing…" : "Import"}
            </Button>
          </div>
        </Panel>

        {/* Calibration: a locked reading until there's enough matched spend, as on the marketing site. */}
        <div className="rounded-card bg-inv text-inv-ink p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between text-[13px] text-inv-muted">
            <span>Pre-flight score vs CTR</span>
            <span>{calibrationReady ? "Your account" : "Locked"}</span>
          </div>
          <div className="font-display text-[48px] leading-none tabular">
            {calibrationReady ? `ρ = ${calibration!.rho!.toFixed(2)}` : "ρ = —.——"}
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: CALIBRATION_MIN }, (_, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i < calibrationN ? "var(--vz-inv-ink)" : "var(--vz-inv-line)" }}
              />
            ))}
          </div>
          <p className="m-0 text-[13px] text-inv-muted">
            {calibrationReady
              ? `Across ${calibration!.n} matched ads with at least 1,000 impressions each.`
              : `${Math.min(calibrationN, CALIBRATION_MIN)} of ${CALIBRATION_MIN} matched ads with 1,000+ impressions. Unlocks at ${CALIBRATION_MIN}.`}
          </p>
        </div>
      </div>

      {summary && (
        <Panel className="mb-5">
          <div className="p-5 flex flex-col gap-3">
            <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Rows", summary.rowsTotal],
                ["Matched", summary.rowsMatched],
                ["Unmatched", unmatchedCount],
                ["Rejected", summary.rowsRejected.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-inner bg-panel px-3.5 py-3">
                  <dt className="text-[12px] text-muted">{label}</dt>
                  <dd className="m-0 font-display text-[24px] tabular">{value}</dd>
                </div>
              ))}
            </dl>

            {summary.rowsRejected.length > 0 && (
              <div className="text-[12px] text-muted flex flex-col gap-0.5">
                {summary.rowsRejected.map((r, i) => (
                  <div key={i}>
                    Line {r.line}: {r.reason}
                  </div>
                ))}
              </div>
            )}

            {unmatchedRows.length > 0 && (
              <div className="text-[12px] text-muted">
                Unmatched rows (no vz_ tag in the ad name): {unmatchedRows.map((r) => r.adName).join(", ")}
              </div>
            )}
          </div>
        </Panel>
      )}

      {creativeRows.length > 0 && (
        <Panel className="mb-5" title="Matched variants">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-muted text-[12px]">
                  <th className="font-semibold px-5 py-2.5">Ad</th>
                  <th className="font-semibold px-5 py-2.5 text-right">Pre-flight</th>
                  <th className="font-semibold px-5 py-2.5 text-right">CTR</th>
                  <th className="font-semibold px-5 py-2.5 text-right">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {creativeRows.map((row) => (
                  <tr key={row.id} className="table-row border-t border-line">
                    <td className="px-5 py-2.5">{row.adName}</td>
                    <td className="px-5 py-2.5 text-right tabular">{row.headline ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular">
                      {row.impressions > 0 ? `${((row.clicks / row.impressions) * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular">{row.impressions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {creativeRows.length === 0 && !summary ? (
        <div className="rounded-panel border border-line bg-panel dots min-h-[200px] flex items-center justify-center p-8 text-center">
          <div>
            <div className="font-semibold text-[15px]">No matched variants yet</div>
            <p className="m-0 mt-1 max-w-[420px] text-[13px] text-muted">
              Name each ad with its tag (like vz_ab12) when you upload it to Ads Manager, then import the
              export here.
            </p>
          </div>
        </div>
      ) : null}

      {pastImports.length > 0 ? (
        <Panel title="Recent imports">
          <ul className="m-0 p-0 list-none">
            {pastImports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line first:border-t-0 px-5 py-3 text-[13px]">
                <span className="min-w-0 truncate font-medium">{i.filename}</span>
                <span className="text-muted tabular">
                  {i.platform === "meta" ? "Meta" : "TikTok"} · {i.rowsMatched} of {i.rowsTotal} matched ·{" "}
                  {new Date(i.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
