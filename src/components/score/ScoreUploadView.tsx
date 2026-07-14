"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

async function pollJob(jobId: string) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(data.error || "Scoring failed");
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Scoring timed out");
}

export function ScoreUploadView() {
  const router = useRouter();
  const search = useSearchParams();
  const [title, setTitle] = useState(search.get("title") || "");
  const [platform, setPlatform] = useState<"tiktok" | "instagram" | "youtube">("tiktok");
  const [durationSec, setDurationSec] = useState(42);
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setStatus("Creating draft…");
      const createRes = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          platform,
          durationSec,
          sourceUrl: sourceUrl || undefined,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || "Create failed");

      if (file) {
        setStatus("Uploading media…");
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch(`/api/content/${created.id}/upload`, { method: "POST", body: fd });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || "Upload failed");
      }

      setStatus("Scoring…");
      const scoreRes = await fetch(`/api/content/${created.id}/score`, { method: "POST" });
      const scoreJson = await scoreRes.json();
      if (!scoreRes.ok) throw new Error(scoreJson.error || "Score failed");

      await pollJob(scoreJson.jobId);
      router.push(`/content/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="vfade max-w-[640px]">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Score content</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Drop in a video or paste a link. Get a Viral Score in under 30 seconds.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-6 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Title
          </span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kitchen hacks pt.3"
            className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Platform
            </span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as typeof platform)}
              className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 bg-[var(--card)]"
            >
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Duration (sec)
            </span>
            <input
              type="number"
              min={5}
              max={3600}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Paste a link (optional)
          </span>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Or upload a file
          </span>
          <input
            type="file"
            accept="video/*,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-[13px] text-[var(--ink-2)]"
          />
        </label>

        {error && (
          <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
            {error}
          </div>
        )}
        {status && !error && (
          <div className="rounded-[10px] bg-[var(--violet-soft)] text-[var(--violet-deep)] text-[12.5px] px-3.5 py-2.5">
            {status}
          </div>
        )}

        <Button type="submit" className="w-full py-3" disabled={busy || !title.trim()}>
          {busy ? "Working…" : "✦ Score this content"}
        </Button>
      </form>
    </div>
  );
}
