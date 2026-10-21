"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
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

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("video/")) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube" },
] as const;

type Platform = (typeof PLATFORMS)[number]["value"];

export function ScoreUploadView() {
  const router = useRouter();
  const search = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(search.get("title") || "");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [durationUnknown, setDurationUnknown] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(picked: File | null) {
    setFile(picked);
    setDurationUnknown(false);
    if (!picked) {
      setDurationSec(null);
      return;
    }
    const duration = await readVideoDuration(picked);
    if (duration != null) {
      setDurationSec(duration);
    } else {
      setDurationSec(null);
      setDurationUnknown(true);
    }
    if (!title.trim()) {
      setTitle(picked.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file && !sourceUrl.trim()) {
      setError("Upload a video or paste a link before scoring — a title alone can't be scored.");
      return;
    }
    setBusy(true);
    try {
      setStatus("Creating draft…");
      const createRes = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          platform,
          durationSec: durationSec ?? undefined,
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
    <div className="vfade max-w-[640px] flex-1">
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0] ?? null;
            if (dropped) void handleFile(dropped);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-[14px] border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
          style={{
            borderColor: dragOver ? "var(--violet)" : "var(--line-strong)",
            background: dragOver ? "var(--violet-soft)" : "transparent",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="text-[13px]">
              <div className="font-semibold">{file.name}</div>
              <div className="text-[var(--ink-3)] mt-1">
                {durationSec != null
                  ? `${durationSec}s — read from the file`
                  : durationUnknown
                    ? "Couldn't read duration from this file"
                    : "Reading duration…"}
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[var(--ink-2)]">
              Drop a video here, or click to choose a file.
              <br />
              <span className="text-[var(--ink-3)]">Duration is read from the file — no need to type it.</span>
            </div>
          )}
        </div>

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

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Platform
          </span>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlatform(p.value)}
                className="rounded-full px-4 py-2 text-[13px] font-medium border transition-colors"
                style={{
                  borderColor: platform === p.value ? "var(--violet)" : "var(--line-strong)",
                  background: platform === p.value ? "var(--violet-soft)" : "var(--card)",
                  color: platform === p.value ? "var(--violet-deep)" : "var(--ink-2)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Or paste a link instead
          </span>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
          />
        </label>

        {durationSec == null && (durationUnknown || !file) && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              {file
                ? "Duration (sec) — couldn’t read this file, enter it manually"
                : "Duration (sec) — we can’t read a link’s length, enter it manually"}
            </span>
            <input
              type="number"
              required
              min={5}
              max={3600}
              value={durationSec ?? ""}
              onChange={(e) => setDurationSec(e.target.value ? Number(e.target.value) : null)}
              className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
            />
          </label>
        )}

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

        <Button
          type="submit"
          className="w-full py-3"
          disabled={busy || !title.trim() || (!file && !sourceUrl.trim())}
        >
          {busy ? "Working…" : "✦ Score this content"}
        </Button>
        {!file && !sourceUrl.trim() && (
          <p className="text-[12px] text-[var(--ink-3)] -mt-2">
            Upload a video or paste a link — a title alone can&rsquo;t be scored.
          </p>
        )}
      </form>
    </div>
  );
}
