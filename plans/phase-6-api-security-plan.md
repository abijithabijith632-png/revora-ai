# Revora AI — Phase 6 Plan: API, Security & Backend Foundation

## Already exists (reuse — do NOT rebuild)
- Standard `success`/`failure` envelopes (`lib/api/response.ts`)
- Centralized error classes + status mapping (`lib/errors`)
- Zod validation + `parseAndValidate` (`lib/validation`)
- `withErrorHandling` wrapper (`server/api`)
- `BaseService` / `BaseRepository` / `TenantRepository` (`server`)
- `requireSession`/`getSession` (Phase 4), `requirePermission`/`userHasPermission` (Phase 5)
- Health endpoint (basic), `audit_logs` schema (Phase 3)

## New reusable pieces (minimal, purposeful)

### 1. `lib/api/query.ts`
- `parsePagination(url)` → `{ page, pageSize }` (safe max 100)
- `parseSort(url, allowlist)` → `{ column, order }` (allowlist only)
- `parseSearch(url)` → trimmed search string
- `parseFilters(url, schema)` → Zod-validated filter object
- `buildPaginationMeta(total, page, pageSize)` → `{ page, pageSize, total, totalPages }`

### 2. `lib/api/context.ts`
- `requireApiContext(permission?)` → resolve session (401 if none) → check permission (403 if missing) → return session + orgId. Thin route handlers use this.

### 3. `lib/api/rate-limit.ts`
- In-memory sliding-window limiter keyed by identifier (IP or userId). No Redis. Documented limitation. Dev-friendly.

### 4. `lib/api/audit.ts`
- `recordAudit(orgId, actorId, action, entityType, entityId, meta?)` — wraps existing `audit_logs` (no new audit system).

### 5. `lib/api/transaction.ts` (optional helper)
- Re-export/document `db.transaction` usage; provide `withTransaction` convenience if valuable.

### 6. Response meta refinement
- Add `paginationMeta` helper + normalize `meta` to `{ page, pageSize, total, totalPages }` for collections.

### 7. Security headers
- `next.config.ts` → add headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, minimal CSP considerations). Keep compatible with Next.js/theme.

### 8. Health endpoint
- Extend `GET /api/health` to report `database: "up" | "down"` (safe, no credentials).

### 9. Documentation
- `docs/API.md` — request lifecycle, auth/permission, response/error envelopes, pagination/filter/sort/search, security, health.

## Validation
- typecheck, lint, build
- API smoke test: pagination/sort allowlist/filter/tenant isolation via a protected stub endpoint (health + a temporary `/api/_probe` if useful) — actually use existing auth/session endpoints + a small script.

## Deferred (future phases)
Lead/client/contact/opportunity CRUD, AI, analytics, SaaS billing, distributed rate limiting (no Redis).
