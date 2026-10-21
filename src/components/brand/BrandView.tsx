"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

type Draft = {
  name: string;
  title: string | null;
  price: string | null;
  currency: string | null;
  imageUrls: string[];
  colors: string[];
};

const EMPTY_DRAFT: Draft = { name: "", title: null, price: null, currency: null, imageUrls: [], colors: [] };

// The source-URL box is also where an import can fail with a malformed
// value left in it. Only carry it into the submission once it's actually a
// URL, so a bad import never blocks the manual-entry fallback the error
// message advertises.
function asValidUrl(value: string): string | undefined {
  if (!value.trim()) return undefined;
  try {
    new URL(value);
    return value;
  } catch {
    return undefined;
  }
}

export function BrandView() {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [imageUrl, setImageUrl] = useState("");
  const [voice, setVoice] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function runImport() {
    if (!url.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/brand/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        // A failed import never blocks setup — open the form empty for
        // manual entry instead, with the error shown above it.
        setImportError(data.error || "Could not import from that link.");
        setDraft(EMPTY_DRAFT);
        return;
      }
      setDraft(data.draft);
      setImageUrl(data.draft.imageUrls[0] || "");
    } catch {
      setImportError("Could not import from that link.");
      setDraft(EMPTY_DRAFT);
    } finally {
      setImporting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          sourceUrl: asValidUrl(url),
          colors: draft.colors,
          voice: voice || undefined,
          logoUrl: logoUrl || undefined,
          product: {
            title: draft.title || draft.name,
            price: draft.price || undefined,
            currency: draft.currency || undefined,
            imageUrls: imageUrl ? [imageUrl] : [],
            url: asValidUrl(url),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Could not save your brand.");
        return;
      }
      setConfirmed(true);
    } finally {
      setSaving(false);
    }
  }

  if (confirmed) {
    return (
      <div className="vfade max-w-[560px]">
        <Panel>
          <div className="p-6">
            <h1 className="font-display text-2xl font-bold m-0 mb-2">Brand confirmed</h1>
            <p className="text-[13px] text-[var(--ink-3)] m-0">
              {draft.name} is ready. The Studio will use this profile for everything you generate.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="vfade max-w-[560px]">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Set up your brand</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Paste your store or product URL, or fill this in yourself. Nothing generates until you
          confirm it.
        </p>
      </div>

      <Panel className="mb-5">
        <div className="p-5 flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
            Store or product URL
          </span>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-store.com/products/..."
              className="flex-1 rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
            />
            <Button type="button" onClick={() => void runImport()} disabled={importing || !url.trim()}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
          {importError && (
            <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
              {importError} You can still fill in the details below yourself.
            </div>
          )}
        </div>
      </Panel>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Panel>
          <div className="p-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Brand name
              </span>
              <input
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Product title
              </span>
              <input
                value={draft.title ?? ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Product image URL
              </span>
              <input
                required
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Brand voice (optional)
              </span>
              <input
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="Warm, a little cheeky, no corporate speak"
                className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
                Logo URL (optional)
              </span>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                className="rounded-[14px] border border-[var(--line-strong)] px-4 py-3 outline-none focus:border-[var(--violet)]"
              />
            </label>
          </div>
        </Panel>

        {saveError && (
          <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
            {saveError}
          </div>
        )}

        <Button type="submit" className="w-full py-3" disabled={saving}>
          {saving ? "Confirming…" : "Confirm brand"}
        </Button>
      </form>
    </div>
  );
}
