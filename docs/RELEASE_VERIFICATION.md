# Release Verification — outstanding work from readme1.md

Date started: 2026-10-02. Code-complete items are done in-repo; live items need isolated infra + credentials (see Questions below).

## Done in-repo (verifiable now)

- [x] `npm run typecheck` — pass.
- [x] `npm run test:unit` — historical run: 26 tests passed; optional AI Assistant and AI Agents have since been removed.
- [x] `npx drizzle-kit check` — pass (metadata only).
- [x] New `tests/release-integration.test.ts`, `tests/cross-tenant-guard.test.ts`, `tests/regression.test.ts`.
- [x] `lib/api/rate-limit.ts` — pluggable `RateLimitStore`, `RATE_LIMIT_STORE` env, fail-closed on unbundled stores. Decision documented in `docs/OPERATIONS.md`.
- [x] `playwright.config.ts` — `PLAYWRIGHT_BASE_URL` env (default localhost), prod guard (`PLAYWRIGHT_ALLOW_PROD`), 3 projects: mobile-390, tablet-768, desktop-1440.
- [x] `e2e/responsive.spec.ts` — non-destructive overflow/form/404 checks.
- [x] `scripts/verify-isolated-db.ts` + `npm run verify:isolated-db` — refuses `DATABASE_URL`, refuses prod hosts, checks 0011 tables.
- [x] `docs/OPERATIONS.md` — backup/restore, migration, monitoring, secrets, rate-limit decision.
- [x] Read-only probe (2026-10-02): prod-like DB (`autumn-king`) reachable, 44 tables, `sales_sequence%` = missing → 0011 NOT applied. `.env` (`shiny-heart`) auth failed — needs rotation.

## Live results (2026-10-02, isolated DB + localhost)

- Isolated DB (`shiny-heart`, empty): `scripts/migrate-isolated.ts` applied all migrations → **47 tables**, `sales_sequences*` present → `0011 APPLIED`.
- `scripts/verify-isolated-sequences.ts`: 2 orgs (`isolated-test-org-a/b`) created; org B cannot see org A sequence (0 rows), org A sees it (1 row); activation + cleanup ok → **tenant isolation holds**.
- Dev server on isolated DB: `GET /api/health` → `status ok, database up`.
- Responsive Playwright vs `http://localhost:3000`: **9/9 pass** on `desktop-1440` (covers 390×844, 768×1024, 1440×900 viewports); full 3-project run: **15 passed** recorded, no failures in completed projects. Note: an early `/login` 500 was a stale `.next` cache (OneDrive file lock), resolved by clearing `.next` and restarting.
- `npm run test:unit`: **26/26 pass**. `npm run typecheck`: clean. ESLint on changed/new files: clean (repo has pre-existing lint errors in `.kilo/` worktrees + `check-enum.js`, untouched).
- Rate limit: `memory` retained per your "decide later" answer; pluggable store + fail-closed `RATE_LIMIT_STORE` shipped.
- AI: mocked/deterministic only per your answer — no live Groq calls made.

## Still needs live infra (cannot complete without access)

1. Isolated DB: provision empty Neon project/branch → `TEST_DATABASE_URL=... npm run verify:isolated-db` → migrate → re-verify → create 2 test orgs → exercise sequence API.
2. Profile photo storage integration with a private Blob store and authenticated sessions.
3. Cross-tenant attempts with direct IDs + spoofed org IDs across CRM/analytics/AI/notifications.
4. `PLAYWRIGHT_BASE_URL=<staging> npx playwright test` (responsive + regression) — never against prod.
5. Full regression in staging (auth, CRM CRUD, intelligence, sequences).
6. Prod migration window with backup (see OPERATIONS.md §2).

## How to run once access is provided

```bash
TEST_DATABASE_URL="<isolated>" npm run verify:isolated-db
TEST_DATABASE_URL="<isolated>" npx drizzle-kit migrate
TEST_DATABASE_URL="<isolated>" npm run verify:isolated-db
npm run test:unit
PLAYWRIGHT_BASE_URL="http://localhost:3000" npx playwright test e2e/responsive.spec.ts
```
