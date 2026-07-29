# Viralyz App

Creator scoring product — shippable beta for real testing. Signal design system, auth-gated multi-user app, upload → score → fix → schedule loop.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **Prisma 7** + SQLite (Postgres-portable schema)
- Deterministic scoring engine (swap for external ML later)
- Local file uploads under `public/uploads/` (S3 later)
- Mock platform connect (creates Platform rows)

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate reset --force   # or: migrate dev + db:seed
npm run db:seed
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

Auth API (canonical production path):

- `POST /api/login` — sign in (`https://app.viralyz.com/api/login`)
- `POST /api/signup` — create account
- `POST /api/logout` — clear session

(` /api/auth/*` aliases remain for compatibility.)

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

## Environments

| Env | Config |
|-----|--------|
| **local** | `DATABASE_URL=file:./prisma/dev.db` (absolute-resolved at runtime) |
| **local + services** | `docker compose up -d` for Postgres/Redis |
| **preview / prod** | Hosted Postgres, S3, real OAuth, `SCORING_SERVICE_URL` |

## Docs

- `BACKEND.md` — entities, APIs, honesty layer  
- `reference/HANDOFF.md` — design tokens  
- `reference/Viralyz App.dc.html` — design reference  

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Prisma generate + production build |
| `npm run db:migrate` | Migrations |
| `npm run db:seed` | Maya + tester seed |
| `npm run lint` | ESLint |
