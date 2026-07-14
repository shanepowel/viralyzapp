"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ScoreRing } from "@/components/ui/ScoreRing";

type Variant = {
  id: string;
  overlay: string;
  gradient: string;
  note: string;
  score: number;
};

export default function ThumbnailsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("ONIONS YOU'RE WRONG");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/tools/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (res.ok) setVariants(data.variants);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="vfade">
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Thumbnails</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            Preview at real feed size. Keep text under three words.
          </p>
        </div>
        <div className="flex gap-3 mb-5 flex-col sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-[14px] border border-[var(--line-strong)] px-4 py-3"
          />
          <Button onClick={() => void generate()} disabled={busy}>
            {busy ? "Building…" : "Generate variants"}
          </Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {variants.map((v) => (
            <Panel key={v.id}>
              <div className="p-4">
                <div
                  className="aspect-[9/16] max-h-[220px] rounded-[14px] relative overflow-hidden mb-3 flex items-end p-3"
                  style={{ background: v.gradient }}
                >
                  <div className="font-display font-bold text-white text-[22px] leading-none drop-shadow">
                    {v.overlay}
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-[var(--ink-2)]">{v.note}</span>
                  <ScoreRing score={v.score} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    router.push(`/score?title=${encodeURIComponent(title)}`)
                  }
                >
                  Use with score
                </Button>
              </div>
            </Panel>
          ))}
        </div>
        {variants.length === 0 && (
          <Panel>
            <div className="p-6 text-[var(--ink-2)]">Generate feed-size thumbnail options.</div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
