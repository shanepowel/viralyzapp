# Viralyz App

Creator scoring product — shippable beta for real testing. Signal design system, auth-gated multi-user app, upload → score → fix → schedule loop.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **Prisma 7** + SQLite (Postgres-portable schema)
- Scoring: local heuristic **or** external ML via `SCORING_SERVICE_URL`
- Storage: local `public/uploads/` **or** S3 / MinIO
- Jobs: in-process queue **or** BullMQ + Redis (`npm run worker`)
- Platforms: demo connect **or** real TikTok / Instagram / YouTube OAuth

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the marketing landing, or [http://localhost:3000/login](http://localhost:3000/login) to sign in.

Auth API (canonical production path):

- `POST /api/login` — sign in
- `POST /api/signup` — create account
- `POST /api/logout` — clear session

(`/api/auth/*` aliases remain for compatibility.)

### Tester accounts

| Email | Password | Notes |
|-------|----------|--------|
| `maya@viralyz.com` | `demo1234` | Seeded demo library, unlimited scores |
| `tester@viralyz.com` | `tester1234` | Empty credits plan (10 scores) |

Or **Create account** on `/login` for a fresh user.

### Core flows

1. Sign in → Dashboard  
2. **Score content** (`/score`) → upload or paste link → poll job → Score Results  
3. Apply a fix → re-score (uses a credit on credits plan)  
4. Schedule for 6pm → Calendar / Library  
5. Create tools: Hook Lab, Script Doctor, Thumbnails, Captions  
6. Grow: Calendar, Trends, Competitors  
7. Earn: Media Kit, public `/kit/[handle]`, Engage, Analytics  
8. **Connect platform** → real OAuth when env vars set, otherwise demo connect  

## Production adapters

All adapters fall back to local implementations when env vars are empty. Check active backends:

```bash
curl http://localhost:3000/api/health
```

| Concern | Env | Local default | Production |
|---------|-----|---------------|------------|
| **Queue** | `REDIS_URL` | Inline `setTimeout` | BullMQ — run `npm run worker` |
| **Storage** | `S3_*` | `public/uploads/` | S3-compatible (AWS / MinIO) |
| **Scoring** | `SCORING_SERVICE_URL` | `src/lib/scorer.ts` | `POST /v1/score` ML service |
| **OAuth** | `TIKTOK_*` / `INSTAGRAM_*` / `YOUTUBE_*` | Demo Platform rows | Auth code + token storage |

### Local services (optional)

```bash
docker compose up -d   # Postgres, Redis, MinIO
npm run worker         # process score jobs from Redis
```

MinIO example env (after compose):

```
S3_BUCKET=viralyz
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=viralyz
S3_SECRET_KEY=viralyzsecret
S3_PUBLIC_URL=http://localhost:9000/viralyz
REDIS_URL=redis://localhost:6379
```

OAuth redirect URIs to register with each provider:

- `{NEXT_PUBLIC_APP_URL}/api/platforms/oauth/tiktok/callback`
- `{NEXT_PUBLIC_APP_URL}/api/platforms/oauth/instagram/callback`
- `{NEXT_PUBLIC_APP_URL}/api/platforms/oauth/youtube/callback`

External scorer contract: `POST {SCORING_SERVICE_URL}/v1/score` with `ScoreInput` JSON → `ScoreOutput` JSON (optional `Authorization: Bearer {SCORING_SERVICE_TOKEN}`).

## Environments

| Env | Config |
|-----|--------|
| **local** | `DATABASE_URL=file:./prisma/dev.db` (absolute-resolved at runtime) |
| **local + services** | `docker compose up -d` + worker |
| **preview / prod** | Hosted Postgres, S3, Redis + worker, real OAuth, `SCORING_SERVICE_URL` |

## Docs

- `BACKEND.md` — entities, APIs, honesty layer  
- `reference/HANDOFF.md` — design tokens  
- `reference/Viralyz App.dc.html` — design reference  

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Prisma generate + production build |
| `npm run worker` | BullMQ score worker (requires `REDIS_URL`) |
| `npm run db:migrate` | Migrations |
| `npm run db:seed` | Maya + tester seed |
| `npm run db:reset` | Reset DB + seed |
| `npm run lint` | ESLint |
