"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";

type Cap = { text: string; score: number };

export default function CaptionsPage() {
  const [topic, setTopic] = useState("kitchen hacks");
  const [captions, setCaptions] = useState<Cap[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/tools/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (res.ok) setCaptions(data.captions);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <AppShell>
      <div className="vfade">
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Captions</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            Caption variants with scores. Copy and attach to a draft.
          </p>
        </div>
        <div className="flex gap-3 mb-5 flex-col sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1 rounded-[14px] border border-[var(--line-strong)] px-4 py-3"
          />
          <Button onClick={() => void generate()} disabled={busy}>
            {busy ? "Writing…" : "Generate captions"}
          </Button>
        </div>
        <div className="grid gap-3">
          {captions.map((c) => (
            <Panel key={c.text}>
              <div className="p-4 flex gap-4 items-start">
                <div className="flex-1 whitespace-pre-wrap text-[13px]">{c.text}</div>
                <ScoreRing score={c.score} />
                <Button size="sm" variant="outline" onClick={() => void copy(c.text)}>
                  {copied === c.text ? "Copied" : "Copy"}
                </Button>
              </div>
            </Panel>
          ))}
          {captions.length === 0 && (
            <Panel>
              <div className="p-6 text-[var(--ink-2)]">Generate scored caption variants.</div>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
