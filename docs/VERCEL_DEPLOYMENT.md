# Deploying Revora AI to Vercel

This guide covers deploying the Revora AI Next.js application to Vercel with a
hosted PostgreSQL database.

## Overview

- **Frontend + API**: Next.js 15 (App Router), deployed as a single Vercel project.
- **Database**: PostgreSQL (hosted). Vercel does not provide a database by default
  in the Hobby plan — use **Neon** (recommended, free tier) or **Supabase**.
- **Build**: `next build` (already verified passing locally).

---

## 1. Prerequisites

1. A [Vercel](https://vercel.com) account.
2. A [GitHub](https://github.com) account (the repo is already pushed to
   `abijithabijith632-png/revora-ai`).
3. A hosted PostgreSQL instance (Neon or Supabase).

---

## 2. Create a hosted PostgreSQL database (Neon)

1. Go to <https://neon.tech> and sign in (GitHub/Google).
2. Click **Create Project**.
3. Choose a region close to your users (e.g. `Mumbai (ap-south-1)`).
4. After creation, Neon shows a **connection string** like:

   ```
   postgresql://USER:PASSWORD@host:5432/neondb?sslmode=require
   ```

5. Copy the full connection string — this becomes `DATABASE_URL`.

> **Supabase alternative**: create a project, then copy the URI from
> **Project Settings → Database → Connection string → URI**.

---

## 3. Set the required environment variables on Vercel

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your hosted Postgres connection string |
| `AUTH_SECRET` | A long random string (generate with `openssl rand -base64 32`) |
| `APP_URL` | `https://<your-project>.vercel.app` (your deployed URL) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Revora AI` |
| `AI_PROVIDER_API_KEY` | Optional — your Groq/OpenAI-compatible key |

Other variables are optional and defaulted in code (see [`.env.example`](../.env.example)).

---

## 4. Apply database migrations

The app ships with Drizzle migrations. Before the app can sign in, the schema
must be created in the hosted database.

From your local machine (with the hosted `DATABASE_URL` set):

```bash
npm install
npm run db:migrate
```

If `db:migrate` reports missing config, verify `DATABASE_URL` is exported in the
shell, or run:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@host:5432/neondb?sslmode=require"
npm run db:migrate
```

---

## 5. Deploy

### Option A — Vercel Dashboard (recommended)

1. Go to <https://vercel.com/new>.
2. Click **Import** on the `revora-ai` GitHub repository.
3. Vercel auto-detects **Next.js** (framework preset).
4. Expand **Environment Variables** and add the variables from step 3.
5. Click **Deploy**.

### Option B — Vercel CLI

```bash
vercel login
vercel link
vercel env add DATABASE_URL production
vercel deploy --prod
```

---

## 6. Verify

1. Open the deployment URL.
2. You are redirected to `/login`.
3. Click **Register**, create your first organization + admin user.
4. After registration, sign in and you land on the dashboard.

---

## 7. Troubleshooting

- **"Missing required environment variable: DATABASE_URL"** — set `DATABASE_URL`
  in Vercel project settings and redeploy.
- **"Connection refused / timed out"** — confirm the hosted DB allows connections
  from Vercel's IPs (Neon/Supabase allow all by default).
- **Cannot sign in** — run `npm run db:migrate` against the hosted DB first.
- **Health check** — `GET https://<your-project>.vercel.app/api/health` returns
  `{ status: "ok" }` when the database is reachable.
