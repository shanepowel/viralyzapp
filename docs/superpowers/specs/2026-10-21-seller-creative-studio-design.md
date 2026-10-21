# Viralyz Seller Creative Studio — Design

Date: 2026-10-21
Status: Draft for review

## 1. Purpose and positioning

Viralyz becomes a creative studio for small brands and sellers running paid and organic ads. The core loop is Discover → Brand → Studio → Pre-flight → Results: pick a reference ad, generate original static ads from your own brand assets, check each one against measurable criteria, then compare those checks with real performance.

Inspired by Zeely (reference → recreate → launch → measure), differentiated by verifiability: every number shown states what was measured, how many checks it rests on, and where its data came from.

Success criteria

- A seller can go from a store URL to four launch-ready static ads in one session.
- No score, ranking, or "winner" claim is shown unless something was measured; empty states are honest.
- The calibration view lets a seller see whether our pre-flight verdicts agree with their own results, once enough data exists.
- The app passes a security and integrity audit: no fabricated data, signed sessions, auditable credits, documented third-party data provenance.

Non-goals (v1)

- Video or avatar generation.
- Launching or managing campaigns on Meta/TikTok (CSV import only).
- Scraped/vendor ad feeds (flagged off until legal review).
- Predicting CTR/ROAS. We verify technical soundness and policy safety; prediction is claimed only if calibration supports it.
- Real-person likeness generation.

## 2. Principles

1. No claim without a measurement. Factors return `scored` or `unavailable`; null, not zero.
2. Provenance on everything. Every reference and every factor carries its source and kind.
3. Structure, not pixels. References are stored as extracted structure plus a link back; other brands' creatives are not redistributed or cloned.
4. Deterministic where possible. Text is composited by our code, so checks on it are computations.
5. Auditable money. Credits are an append-only ledger.

## 3. Data model

New models (Prisma): `Brand`, `Product`, `Reference`, `Creative`, `Check`, `PerformanceImport`, `PerformanceRow`, `CreditLedger`.

- Brand: userId, name, sourceUrl, colors (json), logoUrl, voice (text), confirmedAt.
- Product: brandId, title, price (decimal, nullable), currency, imageUrls (json), url.
- Reference: userId, source (`meta_eu_uk` | `tiktok_ccl` | `user_url` | `user_upload` | `vendor`), sourceRef (external id/URL), advertiser, firstSeenAt, lastSeenAt, daysRunning (nullable), variantCount (nullable), country, structure (json: hookType, layout, offerType, cta), thumbnailUrl (nullable; only for user uploads or where terms permit), fetchedAt.
- Creative: userId, brandId, productId, referenceId?, placement, angle, headline, primaryText, cta, backgroundKey (storage), compositeKey (storage), tag (`vz_` + short id, unique), aiGenerated (bool, always true for generated), status, provider, providerModel, createdAt.
- Check: creativeId, checkVersion, factors (json array of `FactorResult`), headline (int, nullable), headlineBasis (`checks_counted`, `checks_total`), computedAt.
- PerformanceImport: userId, platform, filename, rowsTotal, rowsMatched, rowsRejected (json reasons), createdAt.
- PerformanceRow: importId, creativeId?, adName, impressions, clicks, spend, purchases?, revenue?, ctr (derived), matched (bool).
- CreditLedger: userId, delta (int), kind (`grant` | `reserve` | `settle` | `refund` | `adjust`), refId, note, createdAt. Balance = sum(delta). Invariant: a refund never exceeds its reserve.

Migrated or removed: `User.creditsRemaining` becomes derived from ledger (opening entry per user). `Content`, `ContentVersion`, `Score`, `Fix`, `RetentionCurve`, `ScoreJob`, `Insight`, `MediaKit`, `Trend`, `CompetitorPost`, `EngageComment`, `ToolRun`, `ActualPerformance` are removed in Phase 5 after redirects ship.

`FactorResult` (reused shape): `{ id, label, kind: 'computed'|'rule'|'model', status: 'scored'|'unavailable', value?: number, passed?: boolean, evidence: string, source?: string }`.

## 4. Discover and reference sources

Home screen: filterable grid (category, format, run length, source). Card shows provenance badge and what is known, e.g. "Meta EU/UK · running 94 days · 7 variants". "Use as reference" opens Studio.

Tiers:

1. Official — Meta `ads_archive` (commercial ads delivered to EU/UK, retained ~1 year; requires identity-verified developer account). TikTok Commercial Content API once the application is approved. Ingested by a scheduled job into `Reference`.
2. Yours — paste an Ad Library URL, upload an image, or save from within Discover.
3. Vendor feed — adapter exists behind `FEATURE_VENDOR_ADS`, default off, enabled only after legal review of scraping/terms risk.

"Winner" signal is limited to days running and variant count, labeled as such. The UI never says "high-performing" for a library ad.

Extraction: a model call derives `structure` (hook type, layout, offer, CTA) from the creative; stored with the model name and version.

Constraint: US-only commercial ads are not available from official sources. Discover shows an explicit note about coverage.

## 5. Brand setup

Paste a store/product URL; server fetches page metadata (title, price, images, theme colours) with SSRF protection (block private ranges, redirects limited, size/time caps). User confirms/edits. Confirmed profile conditions all generation. No generation without a confirmed Brand.

## 6. Studio and generation

Composer: product, reference, placement, angle chips, then Generate (4 variants). Variants stream in as they finish. A "regenerate this one" control per variant.

Pipeline per variant:

1. Claude writes headline, primary text, CTA, and an image prompt (no text in the image) from brand profile, product, reference structure, and angle.
2. `ImageProvider.generate({ prompt, productImage, aspect })` returns a background. v1 ships one adapter for a hosted image API (fal or Replicate; chosen at plan time after a current pricing check).
3. Server-side compositor (sharp/satori) renders headline, price, CTA onto the background to the placement spec.
4. Pre-flight runs; Creative and Check are saved.

Jobs run on BullMQ; each variant has its own status; retries are idempotent (keyed by creative id); failure refunds.

Credits: reserve at enqueue → settle on success → refund on failure. Price per variant is config (`provider cost × margin`), not hardcoded.

Safety: prompt moderation; no real-person likeness; every generated creative has `aiGenerated = true` and the UI offers the platform disclosure reminder.

## 7. Pre-flight and calibration

Factor registry; each factor declares kind and returns a `FactorResult`.

- Computed: text contrast ratio, text-to-image area ratio, safe-zone overlap, aspect ratio vs placement, character limits.
- Rule: policy flags (before/after claims, health/income claims, prohibited words), each with the rule text.
- Model (labeled "AI-assessed"): hook clarity against a fixed rubric.

Placement specs live in a data table (`placements.ts`), each row with a source URL.

Headline number counts computed and rule factors only, equal declared weights, shown with basis ("Pre-flight 82 · 6 of 8 checks"). Shown only when at least 4 such factors are scored. Model factors display beside it, excluded from the number until calibration justifies including them.

Results: each Creative has a copyable ad name tag `vz_<id>`. User uploads a Meta Ads Manager or TikTok export CSV; rows match on the tag. Unmatched rows are listed, never silently dropped.

Calibration view: Spearman rank correlation between headline score and CTR across matched ads, only when ≥ 20 matched ads each with ≥ ~1,000 impressions. Always shows N. Otherwise "not enough data." Factor weights change only in versioned offline releases (`checkVersion`), never per user.

## 8. Screens

1. Discover (home) 2. Brand 3. Studio 4. Creatives 5. Results 6. Account (credits, ledger, admin).

Signal v2 design system, AppShell/AppPage, auth, Clerk, queue, storage, email, and rate-limiting carry over. Old routes redirect to Discover.

## 9. Migration order

- Phase 0 — green main. Commit the missing files from the earlier rebuild; add CI (`tsc --noEmit`, `eslint --max-warnings 0`, tests) on every push to `main`.
- Phase 1 — new models, `CreditLedger`, opening-balance migration.
- Phase 2 — Brand, Discover with Tier 1 and Tier 2 sources, references.
- Phase 3 — Studio, provider adapter, compositor, credits flow.
- Phase 4 — factor registry, pre-flight, Results and calibration.
- Phase 5 — remove old creator surfaces, routes, and tables.

## 10. Errors

- Failed variant: automatic refund, retry button.
- Provider down: Generate disabled with message; nothing queued silently.
- Bad CSV: list unmatched/rejected rows with reasons; import nothing ambiguous.
- Ad Library access not yet approved: Discover shows Tier 2 only with a clear note.
- Brand fetch blocked/failed: manual entry fallback.

## 11. Testing

- Unit: factors against fixtures (contrast, safe-zone, char limits); ledger invariants (balance = sum; refund ≤ reserve); CSV tag matcher; SSRF guard.
- Integration: fake `ImageProvider` covering success, partial failure, retry; job idempotency.
- CI gate on every push to `main`.
- Manual before public calibration claims: run a real exported CSV end to end.

## 12. Risks and open items

- Meta identity verification and TikTok application approval are outside our control; Discover must be useful without them.
- Image model fidelity on products varies; mitigated by per-variant regenerate and product-image conditioning.
- Calibration needs user data; early months will mostly show "not enough data."
- Vendor feed legality is unresolved; stays off until reviewed.
- Hosted image provider choice and per-image cost to be confirmed at plan time.
- Copyright/IP: structure-only storage and original generation are the mitigations; legal review recommended before public launch.
