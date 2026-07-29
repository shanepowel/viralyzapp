# Backend Spec — Viralyz App

This covers the data model and API surface implied by the Dashboard + Score Results screens, so the frontend has a real backend to sit on rather than mock data. Adapt names/conventions to Viralyz's existing stack.

## Suggested stack
- API: REST or tRPC on Node (matches a React/Next.js frontend); Postgres for relational data (users, content, scores, fixes) since scores/fixes/versions are highly relational
- Background jobs (queue: e.g. BullMQ/SQS) for: score computation, retention-curve prediction, "next best action" recompute, media-kit stat sync — these are all inference/aggregation jobs, not synchronous request work
- Object storage (S3-compatible) for uploaded video/thumbnail assets
- A model-serving layer (internal ML service or third-party API) behind the scoring endpoints — the UI treats scoring as a black box, so isolate it behind one internal service boundary

## Implemented adapters (swap-in)

| Boundary | Module | Activation |
|----------|--------|------------|
| Jobs | `src/lib/queue.ts` + `scripts/worker.ts` | `REDIS_URL` → BullMQ; else inline |
| Storage | `src/lib/storage.ts` | `S3_BUCKET` + keys → S3; else `public/uploads/` |
| Scoring | `src/lib/scoring-service.ts` | `SCORING_SERVICE_URL` → remote `/v1/score`; else `scorer.ts` |
| OAuth | `src/lib/oauth.ts` + `/api/platforms/oauth/[provider]/*` | Provider client id/secret → real tokens on `Platform` |
| Status | `GET /api/health` | Reports which backends are active |

`Platform` stores `accessToken`, `refreshToken`, `tokenExpiresAt`, `externalAccountId`, `scopes` when OAuth completes.

## Core entities

```
User
  id, name, avatar_url, plan (credits/unlimited), created_at

Platform (connected account)
  id, user_id, provider (tiktok/instagram/youtube), handle, connected_at, sync_status

Content
  id, user_id, title, platform_id, media_type (video), duration_sec,
  thumbnail_url, status (draft/scheduled/tracking/posted),
  scheduled_for (nullable), posted_at (nullable), created_at

ContentVersion
  id, content_id, version_number, created_at
  -- one row per re-score, so "see version 1 (74)" history works

Score
  id, content_version_id, overall_score (0-100),
  component_scores (jsonb: {opening, visuals, pacing, words, timing} each 0-20),
  predicted_views_low, predicted_views_high, confidence_pct, sample_size,
  computed_at

ActualPerformance
  id, content_id, actual_views, measured_at
  -- populated post-publish; drives "predicted vs real" and prediction-accuracy %

Fix
  id, content_version_id, title, description, suggestion_text,
  point_value, rail_severity (low/med/high), applied (bool),
  applied_at (nullable), points_earned (nullable, set once scored again post-apply)

RetentionCurve
  id, content_version_id, curve_points (jsonb array of {t_seconds, pct_remaining}),
  risk_moment_sec (nullable), risk_note (text, nullable)

Insight  -- "What works for you" panel
  id, user_id, statement (text), supporting_note (text),
  metric_key (e.g. "question_hook_lift"), sample_size, computed_at

MediaKit
  id, user_id, views_this_week, new_orders_count, last_synced_at
```

## API endpoints

```
GET  /api/dashboard
  -> { monthly_score, monthly_score_delta, prediction_accuracy_pct, accuracy_delta,
       next_best_action: { content_id, title, score, reason, suggested_slot },
       recent_scores: ContentVersion[] (latest per Content, last N),
       insights: Insight[], media_kit_summary }

GET  /api/content/:id/latest
  -> full Score Results payload: content, current ContentVersion, Score,
     Fix[], RetentionCurve, prior version summaries

POST /api/content/:id/score
  -> triggers (async) scoring job for the current draft/version; returns job id
GET  /api/jobs/:id
  -> job status/result polling (or push via websocket/SSE)

POST /api/content/:id/fixes/:fixId/apply
  -> marks fix applied, enqueues a re-score, returns updated ContentVersion once complete

POST /api/content/:id/schedule
  body: { scheduled_for }
  -> sets status=scheduled

GET  /api/user/momentum
  -> sparkline series for sidebar (recent score trend, e.g. last 6 data points)

GET  /api/media-kit/summary
POST /api/platforms/connect  (OAuth kickoff per provider)
```

## Computation notes (what "next best action" and "insights" actually require)
- **Next best action**: needs, at minimum, each user's per-content-type/per-slot historical performance (to know "6pm is your best slot") and a ranking over draft/unscheduled content by score. Compute this as a scheduled job (e.g. hourly), not per-page-load.
- **Prediction accuracy %**: requires `ActualPerformance` joined against the `Score.predicted_views_*` range at scoring time — only computable once enough posted content has real view data (the UI's "last 34 posts" footnote implies a rolling window, not all-time).
- **"What works for you" insights**: pattern-mining over a user's own historical (Content, Score, ActualPerformance) rows — e.g. hook-type vs. view-lift, day/time vs. performance, duration-bucket vs. retention. Treat as precomputed/cached, refreshed periodically, not live-queried.
- **Retention curve / risk moment**: output of the scoring model; store the full curve so the UI can re-render it without recomputation, and store the flagged risk timestamp so the Fixes panel can cross-reference it.

## Honesty layer (don't skip this — it's core to the design's premise)
The UI explicitly shows *misses* (predicted vs. actual, marked ▼ when wrong) and cites sample sizes on every confidence claim. The backend must retain and expose actual-vs-predicted for **all** scored content that has since been posted, not just the wins — this is a product requirement, not just a UI nicety.
