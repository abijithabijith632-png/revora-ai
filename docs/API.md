# Revora AI — API Conventions

## Request Lifecycle

Every protected API request flows through:

```
Route Handler
  → requireApiContext(permission)   (auth + tenant + RBAC)
  → parseBody / parseQuery          (validation)
  → Service                         (business logic)
  → Repository                      (tenant-scoped DB access)
  → PostgreSQL
  → success() / failure()           (standard envelope)
```

Route handlers stay thin. Do not put business logic, DB queries,
authorization, or response formatting in one handler.

## Authentication & Tenant

- Use [`requireApiContext(permission?)`](../lib/api/context.ts) in route handlers.
- It resolves the authenticated session (401 if missing) and, when a permission
  is supplied, enforces it (403 if denied).
- The `organization_id` always comes from the session — never from the request
  body, query, or headers.

## Authorization

Import `Permission` from [`lib/permissions`](../lib/permissions/index.ts) and pass
`resource.action` (e.g. `"leads.create"`) to `requireApiContext`.

## Standard Success Response

```jsonc
{ "success": true, "data": ..., "message": "OK", "meta": {} }
```

For collections:

```jsonc
{
  "success": true,
  "data": [...],
  "meta": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
}
```

## Standard Error Response

```jsonc
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": { "email": "Invalid email address" }
  }
}
```

Error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `DATABASE_ERROR` (500),
`INTERNAL_ERROR` (500).

## Pagination / Filtering / Sorting / Search

Query parameters:

```
?page=1&pageSize=20&search=abc&sortBy=createdAt&sortOrder=desc&status=qualified
```

- `page` (default 1), `pageSize` (default 20, max 100) — [`parsePagination`](../lib/api/query.ts)
- `sortBy` / `sortOrder` — allowlist-only via [`parseSort`](../lib/api/query.ts)
- `search` — trimmed, max 200 chars via [`parseSearch`](../lib/api/query.ts)
- filters — validated via Zod schema + allowed keys via [`parseFilters`](../lib/api/query.ts)

## Security

- All input treated as untrusted; Zod validation is server-authoritative.
- Parameterized queries (Drizzle) — no string-built SQL.
- Sensitive fields (password_hash, tokens) never returned.
- Security headers set in [`next.config.ts`](../next.config.ts).
- In-memory rate limiting for sensitive endpoints (no Redis; documented limitation).

## Health

`GET /api/health` returns `{ status, database: "up" | "down", ... }` without
exposing credentials.

## Audit

Use [`recordAudit`](../lib/api/audit.ts) to write to `audit_logs`. Never log
secrets/tokens/passwords.

## Phase 7 Readiness

Lead CRUD can be implemented by adding only:
1. Lead Zod schema (validation)
2. Lead service (business rules)
3. Lead repository (tenant-scoped queries)
4. Route handlers (`POST/GET/GET:id/PATCH/DELETE`)

— reusing `requireApiContext`, `parseBody`, `parsePagination`, `parseSort`,
`parseSearch`, `parseFilters`, `success`/`failure`, and `recordAudit`.
