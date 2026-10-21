# Seller Creative Studio Implementation Plan

For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Rebuild Viralyz as a creative studio for small brands: Discover references, set up a Brand, generate original static ads, pre-flight them with measured checks, and calibrate against imported results.

Architecture: New Prisma models and a ledger-based credit system sit beside the existing auth, queue, storage and design-system layers. Generation runs as BullMQ jobs behind an `ImageProvider` interface; text is composited server-side so checks are computations. Old creator surfaces are removed last, after redirects ship.

Tech Stack: Next.js 16 App Router, Prisma 7 (Postgres), BullMQ/Redis, S3 storage, zod, Tailwind v4, Vitest (added in Task 0), sharp (added in Task 9), Anthropic SDK for copy and structure extraction.

Spec: `docs/superpowers/specs/2026-10-21-seller-creative-studio-design.md`

## Global Constraints

- Factor results are `scored` or `unavailable`; never substitute 0 for unknown. (spec §2.1)
- Headline pre-flight number counts `computed` and `rule` factors only, equal weights, shown only when at least 4 such factors are scored. (spec §7)
- Calibration shows only with at least 20 matched ads, each with at least 1,000 impressions; always shows N. (spec §7)
- "Winner" signals for library ads are limited to `daysRunning` and `variantCount`, labelled as such. (spec §4)
- The image model never renders text; headline, price and CTA are composited by our code. (spec §6)
- Credits: reserve at enqueue, settle on success, refund on failure; a refund never exceeds its reserve; balance is the sum of ledger deltas. (spec §3, §6)
- Every generated creative has `aiGenerated = true`. No real-person likeness. (spec §6)
- `FEATURE_VENDOR_ADS` defaults off. (spec §4)
- Ad names use the tag `vz_` + short id, matched exactly; unmatched rows are listed, never dropped. (spec §7)
- CI gate on every push to `main`: `tsc --noEmit`, `eslint --max-warnings 0`, `vitest run`. (spec §9, §11)

## Review Focus

- A product URL that redirects to a private address (`169.254.169.254`, `localhost`, `10.x`) must be refused, not fetched. Owned by Task 3.
- A 200-character headline, emoji, or right-to-left text must not overflow the safe zone or crash the compositor; overflow is reported as a failed check. Owned by Tasks 7 and 9.
- Two simultaneous Generate requests with only enough credits for one must not overdraw the balance. Owned by Task 1.
- A CSV with a UTF-8 BOM, comma decimals, duplicate rows for one tag, or a differently-cased tag must still match or be listed as rejected with a reason. Owned by Task 13.
- A reference whose run length is unknown must show no run-length claim, and an unreachable provider or missing API key must disable Generate rather than queue silently. Owned by Tasks 6 and 11.

## Task 0: Green `main` and CI

Files:

- Create: `vitest.config.ts`, `.github/workflows/ci.yml`, `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json` (scripts: `test`, `check`; devDependency `vitest`)

Interfaces:

- Produces: `npm run check` = `tsc --noEmit && eslint --max-warnings 0 && vitest run`, used by every later task.

- [ ] Step 1: Confirm the working tree contains `src/components/score/Composer.tsx`, `src/components/ui/{EmptyState,Rail}.tsx`, and `src/components/tools/{HookLabView,CaptionsView,ScriptDoctorView,ThumbnailsView}.tsx`; run `git status --short` and verify all appear (staged or tracked).
- [ ] Step 2: Add Vitest with path alias `@` → `src`; add scripts `test` (`vitest run`) and `check`.
- [ ] Step 3: Write `smoke.test.ts` asserting `sessionCookie` round-trip: `parseSession(await serializeSession(user))` returns the user, and a tampered value returns `null` (uses existing `src/lib/session-cookie.ts`).
- [ ] Step 4: Add the CI workflow running `npm ci && npx prisma generate && npm run check` on push and pull_request.
- [ ] Step 5: Run `npm run check`. Expected: exits 0.
- [ ] Step 6: Commit `fix: complete Signal v2 rebuild files; add vitest and CI`; push to `main` and confirm the Actions run is green.

## Task 1: Credit ledger

Files:

- Create: `src/lib/credits.ts`, `src/lib/__tests__/credits.test.ts`
- Modify: `prisma/schema.prisma` (add `CreditLedger`), new migration
- Modify: `src/lib/users.ts` (balance read), sign-up/seed paths that set `creditsRemaining`

Interfaces:

- Produces:
  - `balance(userId: string): Promise<number>`
  - `reserve(userId: string, amount: number, refId: string): Promise<{ ok: true } | { ok: false; reason: "insufficient" }>`
  - `settle(refId: string): Promise<void>`
  - `refund(refId: string): Promise<void>` (idempotent)
  - `grant(userId: string, amount: number, note: string): Promise<void>`
- Model `CreditLedger { id, userId, delta Int, kind String, refId String?, note String?, createdAt }`, index `(userId)`, unique `(refId, kind)` for `reserve` and `refund`.

- [ ] Step 1: Write tests: `balance equals sum of deltas`; `reserve fails with insufficient when amount > balance`; `refund restores exactly the reserved amount`; `refund twice restores once`; `settle after refund is a no-op`; `two concurrent reserves of 6 against balance 10 yield exactly one ok`.
- [ ] Step 2: Run `npx vitest run src/lib/__tests__/credits.test.ts`; expect FAIL (module missing).
- [ ] Step 3: Implement with a Prisma `$transaction` and a per-user row lock (`SELECT ... FOR UPDATE` on the `User` row) so concurrent reserves serialise.
- [ ] Step 4: Migration: for each user insert a `grant` row of `creditsRemaining` with note `opening balance`; keep the column until Task 15.
- [ ] Step 5: Run tests; expect PASS. Commit `feat: append-only credit ledger`.

## Task 2: Domain models

Files:

- Modify: `prisma/schema.prisma`; new migration
- Create: `src/lib/__tests__/schema-shape.test.ts`

Interfaces:

- Produces Prisma models exactly as spec §3: `Brand`, `Product`, `Reference`, `Creative`, `Check`, `PerformanceImport`, `PerformanceRow`. `Creative.tag` is unique and generated by `newTag(): string` (`vz_` + 4 lowercase base36 chars, retry on collision) in `src/lib/tags.ts`.

- [ ] Step 1: Test `newTag` returns `/^vz_[a-z0-9]{4}$/` and `tags are unique across 1,000 calls against a seeded set`.
- [ ] Step 2: Add models and relations (`onDelete: Cascade` from `User`); run `npx prisma migrate dev --name studio_models`.
- [ ] Step 3: Implement `src/lib/tags.ts`; run tests, `npx tsc --noEmit`. Commit `feat: studio domain models`.

## Task 3: SSRF-safe fetch and brand import

Files:

- Create: `src/lib/safe-fetch.ts`, `src/lib/brand-import.ts`, `src/lib/__tests__/safe-fetch.test.ts`, `src/lib/__tests__/brand-import.test.ts`

Interfaces:

- Produces:
  - `safeFetch(url: string, opts?: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number }): Promise<{ status: number; contentType: string; body: string }>`; throws `SafeFetchError` with `code: "blocked_address" | "too_large" | "timeout" | "bad_scheme" | "too_many_redirects"`.
  - `extractBrand(html: string, pageUrl: string): { name: string; title: string | null; price: string | null; currency: string | null; imageUrls: string[]; colors: string[] }` (reads Open Graph, JSON-LD `Product`, `theme-color`).

- [ ] Step 1: Tests for `safeFetch`: rejects `http://localhost`, `http://127.0.0.1`, `http://10.0.0.5`, `http://169.254.169.254`, `http://[::1]`, `file:///etc/passwd`; rejects a public URL that redirects to `169.254.169.254`; rejects a hostname that DNS-resolves to a private address; enforces `maxBytes` (default 2 MB) and `timeoutMs` (default 8000). Resolve DNS first and connect to the checked IP.
- [ ] Step 2: Tests for `extractBrand` against three HTML fixtures (OG-only page, JSON-LD product page, page with no price): price is `null` when absent, never `"0"`.
- [ ] Step 3: Run, expect FAIL; implement; run, expect PASS. Commit `feat: ssrf-safe fetch and brand extraction`.

## Task 4: Brand API and screen

Files:

- Create: `src/app/api/brand/route.ts`, `src/app/api/brand/import/route.ts`, `src/app/brand/page.tsx`, `src/components/brand/BrandView.tsx`
- Test: `src/app/api/brand/__tests__/brand.test.ts`

Interfaces:

- Consumes: `requireApiSession`, `safeFetch`, `extractBrand`, `rateLimit`.
- Produces: `POST /api/brand/import {url}` → `{ draft }` (not saved); `POST /api/brand {name, colors, voice, logoUrl, product}` saves and sets `confirmedAt`; `GET /api/brand` returns the user's brand or `null`.

- [ ] Step 1: Tests: import is rate-limited to 10/min per user; import of a blocked address returns 400 with `blocked_address`; saving requires `name` and at least one product image; GET returns another user's brand never.
- [ ] Step 2: Implement routes and `BrandView` (URL field, editable draft, Confirm button) using Signal v2 primitives and `AppPage`. If import fails for any reason, the form opens empty for manual entry with the error shown; a failed import never blocks setup.
- [ ] Step 3: `npm run check`; commit `feat: brand setup`.

## Task 5: Reference store, user sources and structure extraction

Files:

- Create: `src/lib/references.ts`, `src/lib/structure.ts`, `src/app/api/references/route.ts`, `src/lib/__tests__/references.test.ts`

Interfaces:

- Produces:
  - `type RefStructure = { hookType: string | null; layout: string | null; offerType: string | null; cta: string | null }`
  - `extractStructure(input: { imageUrl?: string; text?: string }): Promise<RefStructure & { model: string }>`; every field `null` when the model is unavailable.
  - `saveUserReference(userId: string, input: { url?: string; file?: StoredObject }): Promise<Reference>` with `source` `user_url` or `user_upload`.
  - `listReferences(filter: { category?: string; source?: string; minDaysRunning?: number; cursor?: string }): Promise<{ items: Reference[]; next?: string }>`

- [ ] Step 1: Tests: saving the same URL twice for one user returns the same row; `extractStructure` returns all-null fields (not guesses) when the API key is unset; `listReferences({ minDaysRunning: 30 })` excludes references whose `daysRunning` is `null`.
- [ ] Step 2: Implement; the Anthropic call is isolated in `structure.ts` behind `hasAnthropic()` added to `src/lib/env.ts`.
- [ ] Step 3: Run tests; commit `feat: reference store and user sources`.

## Task 6: Meta ad library ingestion and Discover

Files:

- Create: `src/lib/ads/meta-archive.ts`, `scripts/ingest-meta.ts`, `src/app/discover/page.tsx`, `src/components/discover/DiscoverView.tsx`, `src/lib/ads/__tests__/meta-archive.test.ts`
- Modify: `src/lib/env.ts` (`metaAdLibraryToken()`, `isVendorAdsEnabled()`), `scripts/worker.ts` (register a daily ingest schedule)

Interfaces:

- Produces:
  - `mapArchiveAd(raw: MetaArchiveAd, now: Date): ReferenceInput` — `daysRunning` = whole days between `ad_delivery_start_time` and `ad_delivery_stop_time ?? now`; `null` when start is missing; `variantCount` from a creative-group count when supplied, else `null`.
  - `fetchArchivePage(params: { countries: ("GB"|"DE"|"FR"|...)[]; search: string; after?: string }): Promise<{ ads: MetaArchiveAd[]; next?: string }>` — throws `NotConfigured` if the token is missing.
- `DiscoverView` shows provenance badge text `"Meta EU/UK · running N days"` only when `daysRunning` is non-null, else just `"Meta EU/UK"`. When the token is missing it shows the Tier 2 empty state with a coverage note.

- [ ] Step 1: Tests with recorded fixtures: `daysRunning is null when start time is absent`; `ad with no stop time counts to now`; `mapArchiveAd stores structure null until extraction runs`; ingest of a page is idempotent on `(source, sourceRef)`.
- [ ] Step 2: Implement; the Discover page reads `listReferences` and filters by source, category and `minDaysRunning`.
- [ ] Step 3: Run `npm run check`; commit `feat: discover and meta archive ingestion`.

## Task 7: Placements and computed factors

Files:

- Create: `src/lib/preflight/types.ts`, `src/lib/preflight/placements.ts`, `src/lib/preflight/computed.ts`, `src/lib/preflight/__tests__/computed.test.ts`

Interfaces:

- Produces:
  - `type FactorResult = { id: string; label: string; kind: "computed" | "rule" | "model"; status: "scored" | "unavailable"; value?: number; passed?: boolean; evidence: string; source?: string }`
  - `type Placement = { id: "meta_feed_1x1" | "meta_feed_4x5" | "story_9x16" | "tiktok_9x16"; width: number; height: number; safeZone: { top: number; bottom: number; left: number; right: number }; headlineMax: number; primaryMax: number; source: string }` and `PLACEMENTS: Record<Placement["id"], Placement>`
  - `contrastRatio(fg: string, bg: string): number` (WCAG formula)
  - `checkContrast`, `checkTextArea`, `checkSafeZone`, `checkAspect`, `checkCharLimits`, each `(layout: CompositeLayout, placement: Placement) => FactorResult`
  - `type CompositeLayout = { width: number; height: number; textBoxes: { role: "headline"|"price"|"cta"; x: number; y: number; w: number; h: number; fg: string; bg: string; overflowed: boolean }[] }`

- [ ] Step 1: Tests: `contrastRatio("#000000","#ffffff") === 21`; `contrastRatio` of identical colours is `1`; `checkContrast` fails below 4.5; `checkSafeZone` fails when a box intersects the story bottom safe zone; `checkAspect` fails when `width/height` differs from the placement by more than 1%; `checkCharLimits` fails at `headlineMax + 1`; any box with `overflowed: true` makes `checkSafeZone` fail with evidence naming the role; an empty `textBoxes` yields `status: "unavailable"`.
- [ ] Step 2: Run, expect FAIL; implement; run, expect PASS. Commit `feat: placements and computed preflight factors`.

## Task 8: Rule and model factors, headline aggregation

Files:

- Create: `src/lib/preflight/rules.ts`, `src/lib/preflight/model-factor.ts`, `src/lib/preflight/aggregate.ts`, tests in `src/lib/preflight/__tests__/`

Interfaces:

- Produces:
  - `checkPolicy(copy: { headline: string; primaryText: string; cta: string }): FactorResult[]` — rules: before/after claims, health claims, income claims, personal-attribute claims, each with the matching rule text as `evidence`.
  - `assessHook(copy: { headline: string }): Promise<FactorResult>` — `kind: "model"`, label includes "AI-assessed", `status: "unavailable"` when `hasAnthropic()` is false.
  - `aggregate(factors: FactorResult[]): { headline: number | null; counted: number; total: number }` — averages `passed`-based 0/100 scores of scored `computed` and `rule` factors; `headline` is `null` when fewer than 4 are scored; model factors never counted.

- [ ] Step 1: Tests: `aggregate returns null headline with 3 scored factors`; `aggregate with 6 of 8 scored, 5 passed → 83, counted 6, total 8`; `model factor is excluded from the headline`; `checkPolicy flags "lose 10kg in 7 days" as a health claim`; `checkPolicy passes neutral copy`.
- [ ] Step 2: Implement; commit `feat: rule factors and aggregation`.

## Task 9: Compositor

Files:

- Create: `src/lib/compose.ts`, `src/lib/__tests__/compose.test.ts`, `assets/fonts/` (one open-licence font with Latin and a fallback for other scripts)
- Modify: `package.json` (add `sharp`)

Interfaces:

- Consumes: `Placement`, `CompositeLayout`.
- Produces: `composeAd(input: { background: Buffer; placement: Placement; headline: string; price: string | null; cta: string; brand: { colors: string[] } }): Promise<{ image: Buffer; layout: CompositeLayout }>` — output size equals the placement; text is wrapped to the safe zone and shrunk down to a floor of 28 px, after which `overflowed: true` is set rather than clipping.

- [ ] Step 1: Tests: output dimensions equal placement; a 200-character headline yields `overflowed: true` and does not throw; an emoji headline and an Arabic headline both return a buffer; `price: null` produces no price box; text colour is chosen from brand colours with contrast ≥ 4.5 against the sampled background region, else falls back to black or white.
- [ ] Step 2: Implement with `sharp` and an SVG text overlay; commit `feat: server-side ad compositor`.

## Task 10: Image provider

Files:

- Create: `src/lib/providers/types.ts`, `src/lib/providers/fake.ts`, `src/lib/providers/fal.ts`, `src/lib/providers/index.ts`, tests in `src/lib/providers/__tests__/`
- Modify: `src/lib/env.ts` (`imageProviderName()`, `hasImageProvider()`)

Interfaces:

- Produces:
  - `interface ImageProvider { name: string; model: string; costPerImage: number; generate(input: { prompt: string; productImageUrl: string; aspect: "1:1"|"4:5"|"9:16" }): Promise<Buffer> }`
  - `getImageProvider(): ImageProvider | null` — `null` when unconfigured.
  - `FakeProvider` with `failNext(n: number)` and `delayMs` for tests.
- Pricing per image lives in config (`CREDIT_PRICE_PER_VARIANT`), not in provider code. Confirm the chosen hosted API's current price and model name before wiring `fal.ts`; record both in the adapter header comment.

- [ ] Step 1: Tests: `getImageProvider returns null when unset`; `FakeProvider.failNext(1)` rejects once then succeeds.
- [ ] Step 2: Implement; commit `feat: image provider boundary`.

## Task 11: Copy writer and generation job

Files:

- Create: `src/lib/copy.ts`, `src/lib/generation.ts`, `src/app/api/studio/generate/route.ts`, `src/app/api/studio/creatives/[id]/route.ts`, tests in `src/lib/__tests__/generation.test.ts`
- Modify: `src/lib/queue.ts` (add `getStudioQueue`, `createStudioWorker`), `scripts/worker.ts`

Interfaces:

- Consumes: `reserve/settle/refund`, `getImageProvider`, `composeAd`, `runPreflight`.
- Produces:
  - `writeCopy(input: { brand: Brand; product: Product; reference: RefStructure | null; angle: "offer"|"problem"|"proof"|"demo" }): Promise<{ headline: string; primaryText: string; cta: string; imagePrompt: string }>`
  - `runPreflight(layout: CompositeLayout, placement: Placement, copy: Copy): Promise<{ factors: FactorResult[]; headline: number | null; counted: number; total: number }>` (in `src/lib/preflight/index.ts`)
  - `POST /api/studio/generate { productId, referenceId?, placement, angles: Angle[] }` → `{ creativeIds: string[] }`; returns 503 `{ error: "generation_unavailable" }` when no provider or no Anthropic key; 402 when `reserve` fails.
  - `processCreativeJob(creativeId: string): Promise<void>` — idempotent: a creative already `ready` is skipped.

- [ ] Step 1: Tests with `FakeProvider`: `successful variant settles credits and saves a Check`; `failed variant refunds exactly once`; `reprocessing a ready creative does nothing`; `two variants where one fails leaves one ready and one failed with balance reduced by one price`; `generate returns 503 when provider is null and reserves nothing`; `generate with insufficient credits returns 402`.
- [ ] Step 2: Implement; every generated `Creative` sets `aiGenerated: true` and stores `provider` and `providerModel`.
- [ ] Step 3: Commit `feat: generation pipeline with credits`.

## Task 12: Studio and Creatives screens

Files:

- Create: `src/app/studio/page.tsx`, `src/components/studio/StudioView.tsx`, `src/components/studio/VariantCard.tsx`, `src/app/creatives/page.tsx`, `src/components/creatives/CreativesView.tsx`

Interfaces:

- Consumes: Task 11 routes; `PreflightBadge` (create in `src/components/ui/PreflightBadge.tsx`: props `{ headline: number | null; counted: number; total: number }`, renders `"Pre-flight 82 · 6 of 8 checks"` or `"Not enough checks to score"` when `headline` is `null`).
- Each `VariantCard` shows factor list with kind badges (`computed`, `rule`, `AI-assessed`), a regenerate button, the copyable `vz_` tag, and an AI-generated notice.

- [ ] Step 1: Build with Signal v2 primitives; poll creative status every 2 s until `ready` or `failed`; failed cards show retry.
- [ ] Step 2: Manual check: run `npm run dev` with `FakeProvider`, generate four variants, kill one, confirm refund and retry. Run `npm run check`; commit `feat: studio and creatives screens`.

## Task 13: CSV import, matcher and calibration

Files:

- Create: `src/lib/results/parse.ts`, `src/lib/results/calibration.ts`, `src/app/api/results/import/route.ts`, `src/app/api/results/calibration/route.ts`, tests in `src/lib/results/__tests__/`

Interfaces:

- Produces:
  - `parseExport(csv: string, platform: "meta"|"tiktok"): { rows: { adName: string; impressions: number; clicks: number; spend: number; purchases: number | null; revenue: number | null }[]; rejected: { line: number; reason: string }[] }` — strips a UTF-8 BOM, accepts comma-decimal numbers, handles quoted fields.
  - `extractTag(adName: string): string | null` — case-insensitive `vz_[a-z0-9]{4}`, returned lowercased.
  - `spearman(xs: number[], ys: number[]): number | null` — average ranks for ties; `null` for fewer than 3 points or zero variance.
  - `calibrate(pairs: { score: number; impressions: number; clicks: number }[]): { n: number; rho: number | null; status: "ok" | "insufficient" }` — `status: "insufficient"` and `rho: null` unless at least 20 pairs have `impressions >= 1000`.

- [ ] Step 1: Tests: `BOM-prefixed CSV parses`; `"1,5%" and "1.5" both parse`; `extractTag("Spring VZ_K3F9 v2") === "vz_k3f9"`; `rows with the same tag are summed, not double-counted as separate ads`; `rows with no tag are returned as unmatched with reason`; `spearman([1,2,3],[1,2,3]) === 1`; `spearman([1,2,3],[3,2,1]) === -1`; `spearman of constant series is null`; `calibrate with 19 qualifying pairs is insufficient`; `calibrate with 20 qualifying pairs returns a rho`.
- [ ] Step 2: Implement; the import route stores `PerformanceImport` and `PerformanceRow`, scopes matching to the importing user's creatives only; commit `feat: results import and calibration`.

## Task 14: Results screen

Files:

- Create: `src/app/results/page.tsx`, `src/components/results/ResultsView.tsx`

- [ ] Step 1: Upload field, import summary (matched / unmatched / rejected with reasons), per-creative table (headline score vs CTR), calibration card showing `rho` and `N` or "Not enough data yet: M of 20 qualifying ads".
- [ ] Step 2: `npm run check`; commit `feat: results screen`.

## Task 15: Navigation, redirects and removal

Files:

- Modify: `src/components/shell/AppShell.tsx` (nav: Discover, Brand, Studio, Creatives, Results, Account), `src/lib/site.ts` equivalents, `next.config.ts` (redirects), `scripts/check-app-routes.mjs` counterpart in the marketing repo
- Delete: `src/app/{engage,competitors,media-kit,calendar,analytics,hook-lab,captions,script-doctor,thumbnails,trends,library,score,content}`, matching `src/app/api/*` routes, `src/components/{score,tools}`, `src/lib/{scorer,scoring-service,jobs,dashboard,content}.ts` where unreferenced
- Modify: `prisma/schema.prisma` (drop `Content`, `ContentVersion`, `Score`, `Fix`, `RetentionCurve`, `ScoreJob`, `Insight`, `MediaKit`, `Trend`, `CompetitorPost`, `EngageComment`, `ToolRun`, `ActualPerformance`, `User.creditsRemaining`), new migration

- [ ] Step 1: Add permanent redirects from every removed route to `/discover`; write a test asserting each old path returns 308 to `/discover`.
- [ ] Step 2: Delete listed files; run `npx tsc --noEmit` and fix dangling imports until clean.
- [ ] Step 3: Migration drops the tables only after a check that `CreditLedger` balances match the old `creditsRemaining` for every user; abort the migration with an error if any differ.
- [ ] Step 4: Update marketing `appRoutes` in the `viralyz` repo to the new routes and run its `check:routes`.
- [ ] Step 5: Add the Account screen (`src/app/account/page.tsx`): balance from `balance(userId)`, ledger history list (kind, delta, note, date), existing admin tools link for admins. Test: the page lists a `refund` entry with a positive delta and never shows a balance that differs from the ledger sum.
- [ ] Step 6: `npm run check`; commit `chore: remove creator surfaces; new navigation`.
