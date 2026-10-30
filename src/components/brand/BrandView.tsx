"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckChip } from "@/components/ui/CheckChip";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

// Same rule as compose.ts: only hex colours reach the ad, anything else is ignored there.
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** <input type="color"> only takes #rrggbb. */
function toSixDigit(c: string): string {
  if (!HEX.test(c)) return "#000000";
  return c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c;
}
const MAX_COLORS = 5;

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

type SavedBrand = {
  name: string;
  sourceUrl: string | null;
  colors: string[];
  voice: string | null;
  logoUrl: string | null;
  products: Array<{
    title: string;
    price: string | null;
    currency: string | null;
    imageUrls: string[];
  }>;
};

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
  const [editingSaved, setEditingSaved] = useState(false);

  // Revisiting the screen edits the saved brand rather than starting from
  // a blank form, which a save would otherwise overwrite wholesale.
  useEffect(() => {
    let cancelled = false;
    async function loadSaved() {
      const res = await fetch("/api/brand");
      if (!res.ok || cancelled) return;
      const { brand } = (await res.json()) as { brand: SavedBrand | null };
      if (!brand || cancelled) return;
      const product = brand.products[0];
      setUrl(brand.sourceUrl ?? "");
      setVoice(brand.voice ?? "");
      setLogoUrl(brand.logoUrl ?? "");
      setDraft({
        name: brand.name,
        title: product?.title ?? null,
        price: product?.price != null ? String(product.price) : null,
        currency: product?.currency ?? null,
        imageUrls: product?.imageUrls ?? [],
        colors: brand.colors ?? [],
      });
      setImageUrl(product?.imageUrls[0] ?? "");
      setEditingSaved(true);
    }
    void loadSaved().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  function setColor(i: number, value: string) {
    setDraft((d) => ({ ...d, colors: d.colors.map((c, j) => (j === i ? value : c)) }));
  }

  const validColors = draft.colors.filter((c) => HEX.test(c));

  if (confirmed) {
    return (
      <div className="vfade max-w-[640px] pt-8">
        <div className="rounded-panel border border-line bg-panel dots p-8">
          <CheckChip state="pass" label="Brand confirmed" />
          <h1 className="font-display text-[28px] sm:text-[34px] m-0 mt-4">{draft.name} is ready</h1>
          <p className="text-[14px] text-muted m-0 mt-2">
            The Studio uses this profile for everything you generate. Next, pick a reference or go
            straight to generating.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/discover">Find a reference</ButtonLink>
            <ButtonLink href="/studio" variant="outline">
              Open Studio
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vfade">
      <PageHeader
        title={editingSaved ? "Your brand" : "Set up your brand"}
        description={
          editingSaved
            ? "This is your saved brand. Edit anything and confirm again to update it."
            : "Paste your store or product URL, or fill this in yourself. Nothing generates until you confirm it."
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-6 items-start">
        <div className="flex flex-col gap-4">
          <Panel>
            <div className="p-5 flex flex-col gap-2">
              <FieldLabel>Store or product URL</FieldLabel>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourstore.com/products/…"
                  aria-label="Store or product URL"
                  className={`${inputClasses} flex-1 min-w-0`}
                />
                <Button onClick={() => void runImport()} disabled={importing || !url.trim()}>
                  {importing ? "Importing…" : "Import"}
                </Button>
              </div>
              {importError && <Notice tone="error">{importError}</Notice>}
            </div>
          </Panel>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Panel>
              <div className="p-5 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Brand name</FieldLabel>
                  <input
                    required
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={inputClasses}
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Brand colours</FieldLabel>
                  <p className="m-0 text-[12px] text-muted">
                    Used for text and buttons on your ads, and checked for contrast on every variant.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {draft.colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-full border border-line bg-card pl-1 pr-1.5 py-1">
                        <input
                          type="color"
                          value={toSixDigit(c)}
                          onChange={(e) => setColor(i, e.target.value)}
                          aria-label={`Colour ${i + 1}`}
                          className="h-7 w-7 cursor-pointer rounded-full border border-line p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
                        />
                        <input
                          value={c}
                          onChange={(e) => setColor(i, e.target.value)}
                          aria-label={`Colour ${i + 1} hex`}
                          className="w-[76px] border-none bg-transparent text-[13px] tabular outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, colors: d.colors.filter((_, j) => j !== i) }))}
                          aria-label={`Remove colour ${i + 1}`}
                          className="h-6 w-6 rounded-full border-none bg-transparent text-muted cursor-pointer hover:bg-panel hover:text-ink"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {draft.colors.length < MAX_COLORS ? (
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, colors: [...d.colors, "#000000"] }))}
                        className="min-h-9 rounded-full border border-dashed border-line-strong bg-transparent px-3.5 text-[13px] font-semibold text-ink cursor-pointer hover:border-muted"
                      >
                        + Add colour
                      </button>
                    ) : null}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Brand voice (optional)</FieldLabel>
                  <input
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="e.g. Warm, direct, a little playful"
                    className={inputClasses}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Logo URL (optional)</FieldLabel>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClasses}
                  />
                </label>
              </div>
            </Panel>

            <Panel title="Product">
              <div className="p-5 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Product title</FieldLabel>
                  <input
                    value={draft.title ?? ""}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder={draft.name || "Product name"}
                    className={inputClasses}
                  />
                </label>

                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <label className="flex flex-col gap-1.5">
                    <FieldLabel>Price (optional)</FieldLabel>
                    <input
                      inputMode="decimal"
                      value={draft.price ?? ""}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value || null })}
                      placeholder="24.00"
                      className={inputClasses}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <FieldLabel>Currency</FieldLabel>
                    <input
                      value={draft.currency ?? ""}
                      onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() || null })}
                      placeholder="GBP"
                      maxLength={3}
                      className={inputClasses}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Product image URL</FieldLabel>
                  <input
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClasses}
                  />
                </label>
              </div>
            </Panel>

            {saveError && <Notice tone="error">{saveError}</Notice>}

            <Button type="submit" disabled={saving || !draft.name}>
              {saving ? "Saving…" : "Confirm brand"}
            </Button>
          </form>
        </div>

        {/* Live preview of what the Studio will draw on. */}
        <aside aria-label="Brand preview" className="lg:sticky lg:top-6 rounded-panel border border-line bg-panel dots p-5 sm:p-8">
          <div className="text-[12px] font-semibold text-muted mb-4">What the Studio will use</div>
          <div className="rounded-card border border-line bg-card overflow-hidden shadow-float">
            <div className="aspect-[4/3] bg-panel flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <span className="text-[12px] text-muted">Product image</span>
              )}
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-8 w-8 rounded-full border border-line object-contain bg-card" />
                ) : null}
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] truncate">{draft.name || "Brand name"}</div>
                  <div className="text-[13px] text-muted truncate">
                    {draft.title || "Product"}
                    {draft.price ? ` · ${draft.currency ?? ""} ${draft.price}`.replace("  ", " ") : ""}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                {validColors.length > 0 ? (
                  validColors.map((c, i) => (
                    <span key={i} title={c} className="h-8 flex-1 rounded-[8px] border border-line" style={{ background: c }} />
                  ))
                ) : (
                  <span className="text-[12px] text-muted">No colours yet. Ads fall back to black and white.</span>
                )}
              </div>
              {voice ? <p className="m-0 text-[13px] text-ink">&ldquo;{voice}&rdquo;</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
