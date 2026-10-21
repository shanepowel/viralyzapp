# Viralyz Seller Creative Studio — Handoff

Date: 2026-10-21

## Where things stood when this was written

- `origin/main` is broken. PR #10 (`claude/signal-v2-rebuild`) merged a partial Signal v2 rebuild: server-wrapper pages for hook-lab, captions, script-doctor and thumbnails import `src/components/tools/*View.tsx`, which do not exist on `main`. `Composer.tsx`, `ui/EmptyState.tsx` and `ui/Rail.tsx` are also missing there, and `ScoreUploadView.tsx` is the old version.
- The complete Signal v2 rebuild exists only as uncommitted files in the local working tree (about 42 modified files plus untracked new ones, on branch `security/session-hardening`). Do not discard them. Do not `git clean` before committing them.
- Task 0 of the plan is already implemented in the working tree and passed review: `vitest.config.ts`, `.github/workflows/ci.yml`, `src/lib/__tests__/smoke.test.ts`, `package.json` (scripts `test` and `check`, devDependency `vitest ^3`), `.gitignore` (`.superpowers/`). It still needs `npm install` (to update `package-lock.json`, which `npm ci` in CI requires), a local `npm run check`, a commit and a push. Delete the stray `.__deltest` file in the repo root.

## First actions

1. `git status`; confirm `Composer.tsx`, `ui/EmptyState.tsx`, `ui/Rail.tsx` and `src/components/tools/{HookLabView,CaptionsView,ScriptDoctorView,ThumbnailsView}.tsx` are present.
2. `npm install && npm run check`. Fix anything that fails.
3. Commit everything (including the spec, the plan and this file) on a branch off `main`, push, and open a PR to `main`. Confirm the CI run is green before merging. Do not push straight to `main` unless the user says so.
4. Then execute Tasks 1 to 15 of the plan in order, with per-task review, using `superpowers:subagent-driven-development` (the user's chosen method). Commit after each task. Normal git writes work in this environment.

## Rulings already made (the plan defects found in the pre-flight scan)

- `checkCharLimits` has the signature `checkCharLimits(copy: { headline: string; primaryText: string }, placement: Placement): FactorResult`, because the layout carries no copy text.
- `CompositeLayout` and `Placement` types live in `src/lib/preflight/types.ts` (created in Task 7). Task 9 imports them from there.
- Task 11 creates `src/lib/preflight/index.ts` (composes the Task 7 and 8 factors into `runPreflight`) and adds `creditPricePerVariant(): number` to `src/lib/env.ts` (reads `CREDIT_PRICE_PER_VARIANT`).

## Deferred minors

- `smoke.test.ts:13`: use `toEqual({ ...user, iat: expect.any(Number) })` instead of `toMatchObject` for a stricter check.

## Constraints worth restating

- No claim without a measurement: null, not 0. Headline pre-flight number counts computed and rule factors only, and appears only with at least 4 scored factors.
- Calibration appears only with at least 20 matched ads with at least 1,000 impressions each, and always shows N.
- `FEATURE_VENDOR_ADS` defaults off. Do not build or enable scraped ad feeds without the user's explicit go-ahead after legal review.
- Anything that pushes to a shared branch, deletes data, or touches production secrets: ask the user first.
- The Meta Ad Library token and the image provider's API key are not available yet; every feature touching them must degrade honestly (see spec §10).

## Related repo

The marketing site is in the separate `viralyz` repo (`apps/web`). Task 15 updates its `appRoutes` in `lib/site.ts` and runs `check:routes`.

## Kickoff prompt to paste into Claude Code

Read `docs/superpowers/HANDOFF.md`, then the spec and plan it links. Fix `main` first (Task 0 is already in the working tree: install, check, commit on a branch, PR, green CI), then execute the plan with superpowers:subagent-driven-development. Stop and ask before merging or pushing to `main`.

## Note on environment mismatch (added 2026-10-21, same day)

This document was written for a local working tree holding ~42 uncommitted files on `security/session-hardening`, with Task 0 already implemented locally. The cloud session that received this handoff has no such working tree — its `/home/user/viralyzapp` is a normal clone with a clean working tree, no uncommitted Signal v2 rebuild, and no Task 0 files. None of `Composer.tsx`, `ui/EmptyState.tsx`, `ui/Rail.tsx`, or `src/components/tools/*View.tsx` exist anywhere in that session's history, and nothing on `origin/main` imports those paths.

What that session found instead: `origin/main` is broken, but for a different, narrower reason — PR #11 ("Apply session hardening: auth routes, session cookie, marketing landing", co-authored by a Copilot App, merged 2026-10-21) reapplied the original, un-reconciled `security/session-hardening` branch wholesale on top of `main` *after* PR #10 had already landed a reconciled version of the same work. That merge reverted most of PR #10: it reintroduced the duplicate `/api/auth/*` routes, the dead marketing page and its CSS, the bare-`AppShell` bug on hook-lab/captions/script-doctor/thumbnails, the fabricated sidebar momentum array, the media-kit's invented score and hardcoded "Verified" badge, and a `Uint8Array`/`BufferSource` type error in `session-cookie.ts` that fails `tsc --noEmit` outright (that is the concrete reason `main` doesn't build — not a missing-file import).

See the session's own report back to the user for the full comparison and the question of how to reconcile PR #10 and PR #11 before any of Tasks 1-15 start.
