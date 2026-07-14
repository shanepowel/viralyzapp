# Viralyz App

Creator scoring product — Dashboard + Score Results as the pattern library (“Signal” visual language).

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **Prisma 7** + SQLite for local demo (Postgres-ready schema notes in `BACKEND.md`)
- REST API routes matching the backend handoff
- In-process mock scoring jobs (swap for BullMQ/SQS + real model service later)

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Home → Dashboard (Maya R. demo data)
- Click a recent score row → Score Results
- Apply a fix → re-score job → updated version

## Environments

| Env | Config |
|-----|--------|
| **local** | SQLite via `DATABASE_URL=file:./dev.db` (default `.env.example`) |
| **local + services** | `docker compose up -d` for Postgres/Redis; point `DATABASE_URL` at Postgres and change Prisma `provider` to `postgresql` |
| **preview / prod** | Hosted Postgres, Redis/SQS, S3, real `SCORING_SERVICE_URL`, platform OAuth secrets — see `.env.example` |

## Docs & design

- `BACKEND.md` — entities, APIs, computation notes, honesty layer
- `reference/HANDOFF.md` — design tokens, screens, components
- `reference/Viralyz App.dc.html` — interactive design reference (open in a browser)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Generate Prisma client + production build |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Load Maya demo dataset |
| `npm run lint` | ESLint |

## API surface

- `GET /api/dashboard`
- `GET /api/content/:id/latest`
- `POST /api/content/:id/score`
- `GET /api/jobs/:id`
- `POST /api/content/:id/fixes/:fixId/apply`
- `POST /api/content/:id/schedule`
- `GET /api/user/momentum`
- `GET /api/media-kit/summary`
- `POST /api/platforms/connect` (OAuth stub)
