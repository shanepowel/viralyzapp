"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

type Line = { line: number; text: string; note: string; delta: number };

export default function ScriptDoctorPage() {
  const [script, setScript] = useState(
    "Hey guys so basically I just want to show you this onion trick.\nCut like this.\nSee how much faster that is?",
  );
  const [lines, setLines] = useState<Line[]>([]);
  const [delta, setDelta] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLines(data.lines);
      setDelta(data.delta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="vfade">
        <div className="py-[22px] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold m-0">Script Doctor</h1>
            <p className="text-[13px] text-[var(--ink-3)] mt-1">
              Line-by-line feedback with score deltas.
            </p>
          </div>
          {lines.length > 0 && (
            <div className="font-mono text-[13px] text-[var(--ink-2)]">
              Net delta{" "}
              <b style={{ color: delta >= 0 ? "var(--s90)" : "var(--s30)" }}>
                {delta >= 0 ? "+" : ""}
                {delta}
              </b>
            </div>
          )}
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={8}
          className="w-full rounded-[14px] border border-[var(--line-strong)] p-4 mb-4 font-[family-name:var(--font-body)] text-[14px]"
        />
        <Button onClick={() => void analyze()} disabled={busy} className="mb-5">
          {busy ? "Reading…" : "Analyze script"}
        </Button>
        {error && <div className="mb-4 text-[var(--s30)]">{error}</div>}
        <div className="grid gap-3">
          {lines.map((l) => (
            <Panel key={l.line}>
              <div className="p-4">
                <div className="flex justify-between gap-3 mb-1">
                  <span className="font-mono text-[11px] text-[var(--ink-3)]">Line {l.line}</span>
                  <span
                    className="font-mono text-[11.5px] font-semibold"
                    style={{ color: l.delta >= 0 ? "var(--s90)" : "var(--s30)" }}
                  >
                    {l.delta >= 0 ? "+" : ""}
                    {l.delta}
                  </span>
                </div>
                <div className="font-semibold text-[13px] mb-1">{l.text}</div>
                <div className="text-[12.5px] text-[var(--ink-2)]">{l.note}</div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
