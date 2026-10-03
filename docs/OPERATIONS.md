# Operations Runbook — SHE Software Solutions / Revora AI

Target stack: Next.js on Vercel (`bom1`), PostgreSQL on Neon, Drizzle ORM.

## 1. Environments

| Concern | Rule |
|---|---|
| Production DB | The Neon host behind `.env.local` (`...autumn-king...`) serves `https://revora-ai-omega.vercel.app`. Treat as production. |
| Dev DB | `.env` (`...shiny-heart...`) currently fails auth — rotate/replace before use. |
| Isolated test DB | REQUIRED before release. Provision a separate empty Neon project/branch. Never reuse production. Use `TEST_DATABASE_URL` only (see `scripts/verify-isolated-db.ts`). `npm run verify:isolated-db` refuses production hosts unless `ALLOW_PROD_DB=1`. |
| Secrets | `DATABASE_URL`, `AUTH_SECRET`, `AI_PROVIDER_API_KEY`, `EMAIL_*`, `PAYMENT_*` are server-only. Never put secrets in `NEXT_PUBLIC_*`. Rotate via Vercel dashboard + Neon dashboard, never in chat/logs. |

## 2. Database: backup / restore / migrations

- Neon provides automatic backups + point-in-time restore (see Neon dashboard → Backups). Before any prod migration: create a named backup/branch, record the restore point, then migrate.
- There are no down-migrations in `db/migrations/`. Rollback = restore from backup/branch or forward-fix migration. Do not hand-edit prod tables.
- Release procedure:
  1. `TEST_DATABASE_URL=<isolated> npm run verify:isolated-db` → expect `0011 MISSING` on a fresh DB.
  2. `TEST_DATABASE_URL=<isolated> npx drizzle-kit migrate` (isolated only).
  3. Re-run verify → expect `0011 APPLIED` + 47 tables (44 + 3 sequence tables).
  4. Run `npm run test:unit` + staging E2E before touching prod.
  5. Prod window: backup → `npm run db:migrate` against prod URL from a controlled machine → `GET /api/health` must return `database: up`.

## 3. Rate limiting (Task 6 decision)

- Bundled store: in-memory sliding window (`lib/api/rate-limit.ts`), now behind a `RateLimitStore` interface.
- `RATE_LIMIT_STORE` env: only `memory` is implemented. Any other value fails closed with a clear error — this prevents silently running unshared counters in production.
- Decision:
  - Single-instance / low-traffic: `memory` is acceptable.
  - Vercel serverless / multi-instance (current deploy): in-memory counters are per-invocation and DO NOT share. Options: (a) accept reduced enforcement + rely on provider throttles, (b) add a shared store (Upstash Redis) — requires adding a dependency and is outside the locked minimal stack, needs explicit approval.
  - No shared store has been provisioned. Default remains `memory` with the limitation documented here and in code.

## 4. Monitoring

- `GET /api/health` returns `{ status, environment, database, timestamp }`. Poll it from Vercel checks or an external uptime monitor. `database: down` = degraded.
- Watch Vercel function logs for `[health] database check failed`, `AI provider error`, `RateLimitedError` spikes.
- AI provider: Groq default, 25s timeout, JSON-mode, deterministic fallback. No key = features gated, never fabricated. Monitor `method: deterministic_provider_fallback` in `ai_agent_run` audit rows.

## 5. AI data handling

- Model receives only authorized CRM context; lead email is sent as availability boolean, not the address.
- Agent outputs are recommendations; writes require `confirmed: true` via `/api/agents/actions` + existing services + `recordAudit`.
- Email actions create drafts only (`sent: false`). No auto-send, no deletes, no permission changes, no SQL execution.

## 6. Deployment checklist (prod)

- [ ] Vercel env: `DATABASE_URL` (pooled Neon), `AUTH_SECRET` (32B random), `APP_URL`/`NEXT_PUBLIC_APP_URL` = prod URL, AI keys only if enabled.
- [ ] `npm run typecheck`, `npm run test:unit`, `npx drizzle-kit check` green.
- [ ] Isolated DB migration verified, staging E2E green at 390/768/1440.
- [ ] Backup taken, migration applied, `/api/health` = `up`.
