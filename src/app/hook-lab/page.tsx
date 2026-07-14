"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";

type Hook = { id: string; text: string; score: number };

export default function HookLabPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("onion kitchen hack");
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setHooks(data.hooks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="vfade">
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Hook Lab</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            Ten opening lines for every idea, each one scored.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="flex-1 rounded-[14px] border border-[var(--line-strong)] px-4 py-3"
            placeholder="Your idea"
          />
          <Button onClick={() => void generate()} disabled={busy}>
            {busy ? "Scoring…" : "Generate hooks"}
          </Button>
        </div>
        {error && <div className="mb-4 text-[var(--s30)] text-[13px]">{error}</div>}
        <div className="grid gap-3">
          {hooks.map((h) => (
            <Panel key={h.id}>
              <div className="p-4 flex items-center gap-4 justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-[14px]">{h.text}</div>
                </div>
                <ScoreRing score={h.score} />
                <Button
                  size="sm"
                  onClick={() => router.push(`/score?title=${encodeURIComponent(h.text)}`)}
                >
                  Use in score
                </Button>
              </div>
            </Panel>
          ))}
          {hooks.length === 0 && (
            <Panel>
              <div className="p-6 text-[var(--ink-2)]">
                Enter an idea and generate scored openers.
              </div>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
