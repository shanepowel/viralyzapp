"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

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

type CreativeRow = ImportRow & { headline: number | null };

export function ResultsView() {
  const [platform, setPlatform] = useState<"meta" | "tiktok">("meta");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [creativeRows, setCreativeRows] = useState<CreativeRow[]>([]);
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
      setCreativeRows(withHeadline);

      await loadCalibration();
    } catch {
      setUploadError("Could not import this file.");
    } finally {
      setUploading(false);
    }
  }

  const unmatchedCount = summary ? summary.rowsTotal - summary.rowsMatched - summary.rowsRejected.length : 0;
  const unmatchedRows = summary?.rows.filter((r) => !r.matched) ?? [];

  return (
    <div className="vfade">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Results</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Upload a Meta Ads Manager or TikTok export to compare pre-flight scores with real performance.
        </p>
      </div>

      <Panel className="mb-5">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(["meta", "tiktok"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className="font-mono text-[12px] rounded-full px-3.5 py-1.5 border cursor-pointer"
                style={
                  platform === p
                    ? { background: "var(--violet)", color: "#fff", borderColor: "var(--violet)" }
                    : { background: "var(--card)", color: "var(--ink)", borderColor: "var(--line-strong)" }
                }
              >
                {p === "meta" ? "Meta Ads Manager" : "TikTok Ads Manager"}
              </button>
            ))}
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-[13px]"
          />

          {uploadError && (
            <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
              {uploadError}
            </div>
          )}

          <Button onClick={() => void upload()} disabled={!file || uploading}>
            {uploading ? "Importing…" : "Import"}
          </Button>
        </div>
      </Panel>

      {summary && (
        <Panel className="mb-5">
          <div className="p-5 flex flex-col gap-3">
            <div className="text-[13px] text-[var(--ink-2)]">
              <span className="font-semibold text-[var(--s90)]">{summary.rowsMatched} matched</span>
              {" · "}
              <span className="font-semibold text-[var(--s50)]">{unmatchedCount} unmatched</span>
              {" · "}
              <span className="font-semibold text-[var(--s30)]">{summary.rowsRejected.length} rejected</span>
              {" of "}
              {summary.rowsTotal} rows
            </div>

            {summary.rowsRejected.length > 0 && (
              <div className="text-[12px] text-[var(--ink-3)] flex flex-col gap-0.5">
                {summary.rowsRejected.map((r, i) => (
                  <div key={i}>
                    Line {r.line}: {r.reason}
                  </div>
                ))}
              </div>
            )}

            {unmatchedRows.length > 0 && (
              <div className="text-[12px] text-[var(--ink-3)]">
                Unmatched rows: {unmatchedRows.map((r) => r.adName).join(", ")}
              </div>
            )}
          </div>
        </Panel>
      )}

      {creativeRows.length > 0 && (
        <Panel className="mb-5">
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-[var(--ink-3)] font-mono text-[11px] uppercase">
                  <th className="pb-2 pr-4">Ad</th>
                  <th className="pb-2 pr-4">Pre-flight</th>
                  <th className="pb-2 pr-4">CTR</th>
                  <th className="pb-2">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {creativeRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-4">{row.adName}</td>
                    <td className="py-2 pr-4">{row.headline ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {row.impressions > 0 ? `${((row.clicks / row.impressions) * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-2">{row.impressions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-2">
            Calibration
          </div>
          {calibration ? (
            calibration.status === "ok" ? (
              <div className="text-[14px] text-[var(--ink)]">
                ρ = {calibration.rho?.toFixed(2)} across {calibration.n} matched ads
              </div>
            ) : (
              <div className="text-[13px] text-[var(--ink-3)]">
                Not enough data yet: {calibration.n} of 20 qualifying ads
              </div>
            )
          ) : (
            <div className="text-[13px] text-[var(--ink-3)]">Import performance data to see calibration.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
