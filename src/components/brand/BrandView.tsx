"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { SAMPLE_BRAND } from "@/lib/samples";

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

export function BrandView({ importUrl = null }: { importUrl?: string | null }) {
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
      if (cancelled) return;
      if (!brand) {
        // Arrived from viralyz.com with a shop link and nothing saved yet:
        // read the page straight away. A saved brand is never overwritten.
        if (importUrl) {
          setUrl(importUrl);
          void runImport(importUrl);
        }
        return;
      }
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
    // Runs once on arrival; importUrl comes from the page's query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runImport(target: string = url) {
    if (!target.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/brand/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
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

  /** Fills the form with a fictional brand so the product can be tried before importing a real one. */
  function fillSampleBrand() {
    setImportError(null);
    setUrl("");
    setVoice(SAMPLE_BRAND.voice);
    setLogoUrl("");
    setDraft({
      name: SAMPLE_BRAND.name,
      title: SAMPLE_BRAND.product.title,
      price: SAMPLE_BRAND.product.price,
      currency: SAMPLE_BRAND.product.currency,
      imageUrls: [],
      colors: [...SAMPLE_BRAND.colors],
    });
    // The image generator fetches this link, so it has to be absolute.
    setImageUrl(`${window.location.origin}${SAMPLE_BRAND.product.image}`);
  }

  function setColor(i: number, value: string) {
    setDraft((d) => ({ ...d, colors: d.colors.map((c, j) => (j === i ? value : c)) }));
  }

  const validColors = draft.colors.filter((c) => HEX.test(c));

  if (confirmed) {
    return (
      <div className="vfade grid grid-cols-1 gap-6 pt-10 md:grid-cols-[200px_1fr]">
        <p className="kicker m-0 pt-2 text-pass">Brand confirmed</p>
        <div className="max-w-[640px]">
          <h1 className="font-display m-0 text-[34px] sm:text-[44px]">{draft.name} is ready.</h1>
          <p className="m-0 mt-3 text-[15px] text-ink-2">
            Studio uses this profile for every ad you make. Start a batch now, or find a reference to follow first.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/studio?new=1">New batch</ButtonLink>
            <ButtonLink href="/discover" variant="outline">
              Find a reference
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const section = "grid grid-cols-1 gap-x-8 gap-y-3 border-b border-line py-6 md:grid-cols-[200px_1fr]";

  return (
    <div className="vfade">
      <PageHeader
        kicker="Brand"
        title={editingSaved ? "Your brand" : "Set up your brand"}
        description={
          editingSaved
            ? "This is what Studio draws from. Change anything and confirm again to update it."
            : "Paste your shop or product link and we will read what we can, or fill it in yourself. Nothing is made until you confirm."
        }
      />

      <div className="grid grid-cols-1 items-start gap-x-12 gap-y-8 border-t border-rule lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className={section}>
            <p className="kicker m-0 pt-3 text-ink">
              <span className="text-muted">1 </span>Import
            </p>
            <div className="flex max-w-[640px] flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourshop.com/products/…"
                  aria-label="Shop or product link"
                  className={`${inputClasses} min-w-0 flex-1`}
                />
                <Button variant="outline" onClick={() => void runImport()} disabled={importing || !url.trim()}>
                  {importing ? "Reading…" : "Read page"}
                </Button>
              </div>
              {importError && (
                <Notice tone="error">{importError} You can fill in the details below by hand instead.</Notice>
              )}
              {editingSaved ? null : (
                <p className="m-0 text-[13px] text-ink-2">
                  No shop yet?{" "}
                  <button
                    type="button"
                    onClick={fillSampleBrand}
                    className="min-h-9 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-ink underline underline-offset-4"
                  >
                    Fill in a sample brand
                  </button>{" "}
                  (Halden, a fictional skincare brand) and change it later.
                </p>
              )}
            </div>
          </div>

          <form onSubmit={onSubmit}>
            <div className={section}>
              <p className="kicker m-0 pt-1 text-ink">
                <span className="text-muted">2 </span>Brand
              </p>
              <div className="flex max-w-[640px] flex-col gap-5">
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
                  <p className="m-0 text-[13px] text-ink-2">
                    Used for text and buttons on your ads, and checked for contrast on every one.
                  </p>
                  <div className="mt-1 border-t border-rule">
                    {draft.colors.map((c, i) => (
                      <div key={i} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-line py-1.5">
                        <input
                          type="color"
                          value={toSixDigit(c)}
                          onChange={(e) => setColor(i, e.target.value)}
                          aria-label={`Colour ${i + 1}`}
                          className="h-9 w-9 cursor-pointer border border-rule p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                        />
                        <input
                          value={c}
                          onChange={(e) => setColor(i, e.target.value)}
                          aria-label={`Colour ${i + 1} hex`}
                          aria-invalid={!HEX.test(c)}
                          className={`min-h-9 w-[120px] border-0 bg-transparent font-mono text-[13px] uppercase outline-none ${
                            HEX.test(c) ? "text-ink" : "text-mark"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, colors: d.colors.filter((_, j) => j !== i) }))}
                          aria-label={`Remove colour ${i + 1}`}
                          className="min-h-9 cursor-pointer border-0 bg-transparent font-mono text-[11px] uppercase tracking-[0.06em] text-muted underline underline-offset-4 hover:text-mark"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {draft.colors.length < MAX_COLORS ? (
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, colors: [...d.colors, "#000000"] }))}
                        className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-ink underline underline-offset-4"
                      >
                        Add a colour
                      </button>
                    ) : null}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Voice, optional</FieldLabel>
                  <input
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    placeholder="Warm, direct, a little playful"
                    className={inputClasses}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Logo link, optional</FieldLabel>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClasses}
                  />
                </label>
              </div>
            </div>

            <div className={section}>
              <p className="kicker m-0 pt-1 text-ink">
                <span className="text-muted">3 </span>Product
              </p>
              <div className="flex max-w-[640px] flex-col gap-5">
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
                    <FieldLabel>Price, optional</FieldLabel>
                    <input
                      inputMode="decimal"
                      value={draft.price ?? ""}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value || null })}
                      placeholder="24.00"
                      className={`${inputClasses} font-mono`}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <FieldLabel>Currency</FieldLabel>
                    <input
                      value={draft.currency ?? ""}
                      onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() || null })}
                      placeholder="GBP"
                      maxLength={3}
                      className={`${inputClasses} font-mono`}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Product image link</FieldLabel>
                  <input
                    required
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClasses}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-3 py-6 md:grid-cols-[200px_1fr]">
              <span />
              <div className="flex max-w-[640px] flex-col gap-3">
                {saveError && <Notice tone="error">{saveError}</Notice>}
                <Button type="submit" disabled={saving || !draft.name} className="self-start">
                  {saving ? "Saving…" : editingSaved ? "Confirm changes" : "Confirm brand"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* What Studio will draw from, updated as the form changes. */}
        <aside aria-label="Brand sheet" className="border border-rule bg-card lg:sticky lg:top-20 lg:mt-6">
          <p className="kicker m-0 border-b border-rule px-4 py-2.5 text-ink">Brand sheet</p>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <span className="hatch flex h-full w-full items-center justify-center">
                <span className="bg-card px-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                  Product image
                </span>
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 w-8 border border-line bg-card object-contain" />
              ) : null}
              <div className="min-w-0">
                <div className="font-display truncate text-[20px]">{draft.name || "Brand name"}</div>
                <div className="mt-1 truncate text-[13px] text-ink-2">
                  {draft.title || "Product"}
                  {draft.price ? (
                    <span className="font-mono text-[12px] text-muted">
                      {" "}
                      {draft.currency ?? ""} {draft.price}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {validColors.length > 0 ? (
              <div>
                <div className="flex border border-rule">
                  {validColors.map((c, i) => (
                    <span key={i} title={c} className="h-9 flex-1" style={{ background: c }} />
                  ))}
                </div>
                <p className="m-0 mt-1.5 font-mono text-[11px] uppercase text-muted">{validColors.join("  ")}</p>
              </div>
            ) : (
              <p className="m-0 text-[13px] text-muted">No colours yet. Ads fall back to black and white.</p>
            )}
            {voice ? (
              <p className="m-0 border-t border-line pt-3 text-[13px] text-ink-2">
                <span className="kicker mr-2">Voice</span>
                {voice}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
