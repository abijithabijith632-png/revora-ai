# Revora AI — Architecture

## 1. Overview

Revora AI is a **single Next.js application** that provides both the frontend
and backend (via Route Handlers + Server Components), backed by **PostgreSQL**.

The architecture is deliberately layered so that business logic, data access,
validation, and AI capabilities remain testable and reusable across the full
25-phase roadmap.

```
Route Handler / Server Component
        │
        ▼
   Service layer (business logic, tenant + auth enforcement)
        │
        ▼
   Repository layer (the ONLY place issuing SQL queries)
        │
        ▼
   Drizzle ORM  ──►  PostgreSQL
```

## 2. Directory Responsibilities

| Path | Responsibility |
|---|---|
| `app/` | Routing, layouts, pages, loading/error boundaries, API routes |
| `components/ui/` | Design-system primitives (Button, Card, Badge, Input, Skeleton, forms, tooltip, overlay, toast, table, avatar, states, KPI card, page header, logo) |
| `components/layout/` | AppShell, Sidebar (collapsible), Topbar, ThemeToggle, nav model |
| `components/dashboard/` | Dashboard-specific presentational components |
| `components/ai/` | AI visual components (CSS-only 3D orb, insight card, confidence, processing) |
| `lib/errors/` | Typed error classes + HTTP status mapping |
| `lib/api/` | Standard success/error response envelopes |
| `lib/validation/` | Zod schemas + `parseAndValidate` |
| `lib/auth/` | Auth session contract (implementation in later phase) |
| `lib/permissions/` | RBAC roles + permissions vocabulary |
| `lib/tenant/` | Tenant context abstraction |
| `server/services/` | Business-logic service layer |
| `server/repositories/` | Data-access layer (Drizzle queries) |
| `server/api/` | Route handler conventions (e.g. error wrapper) |
| `db/schema/` | Drizzle table definitions + conventions |
| `db/migrations/` | Generated SQL migrations |
| `db/seed/` | Development-only seed |
| `services/ai/` | AI service contracts (explainable) |
| `types/` | Shared TypeScript types |
| `config/` | Server/client env access |
| `public/` | Static assets |

## 3. Server / Client Boundary

- **Server Components** are the default; `"use client"` is used only for
  interactive leaf components (theme toggle, sidebar, buttons via primitives).
- **Secrets** are accessed exclusively via [`config/env.ts`](../../config/env.ts)
  `serverEnv`, which is never imported from client code.
- **Public variables** are limited to `NEXT_PUBLIC_*` via `publicEnv`.

## 4. API Conventions

Standard envelope — see [`lib/api/response.ts`](../../lib/api/response.ts):

```jsonc
// success
{ "success": true, "data": ..., "message": "...", "meta": {} }
// error
{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }
```

Route handlers wrap work with `withErrorHandling` so thrown `AppError`s map
to consistent HTTP statuses.

## 5. Error Handling

Centralized in [`lib/errors`](../../lib/errors/index.ts). Errors carry stable
`code`s: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `DATABASE_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`. Production
responses never include stack traces, secrets, or internal causes.

## 6. Database & Multi-Tenancy

- **Tenant root:** `organizations`.
- **Tenant ownership:** every tenant-owned table carries `organization_id`
  (UUID) referencing `organizations.id`.
- **Conventions:** UUID PKs, `created_at`/`updated_at`, `deleted_at` soft-delete,
  indexes on tenant + frequently-queried columns, unique constraints.
- **Isolation:** enforced server-side at the query layer (repositories apply
  `organization_id` scope). Frontend filtering is never the isolation boundary.
- **Migrations:** Drizzle Kit (`db:generate`, `db:migrate`).

## 7. AI Architecture (Explainability)

`services/ai/types.ts` defines capability interfaces (scoring, qualification,
next-action, follow-up, summary, prediction, risk). Every result must conform
to [`ExplainableAiResult`](../../types/ai/index.ts):

```ts
{
  result, score?, confidence?,
  reasons: string[],
  positiveSignals: string[],
  riskSignals: string[],
  supportingData?, recommendation?
}
```

No algorithms or fake outputs are implemented in Phase 1.

## 8. Design System, Theming & Motion

- Tokens live once in [`app/globals.css`](../../app/globals.css) as CSS
  variables, mapped into Tailwind via `@theme`. Components never hardcode
  colors.
- Light/dark theming swaps the variables under `.dark` (via `next-themes`).
- Micro-interactions (hover/focus/active) are CSS-only, fast, and purposeful.
- Reduced-motion is respected globally.
- 3D direction is reserved for high-value areas (AI orb) using pure CSS —
  no Three.js or 3D framework (locked out).

## 9. Phase Roadmap Boundaries

Phase 1 = foundation. Later phases extend the service/repository/schema layers
without restructuring. Each business domain will add: schema → repository →
service → API route → UI, following the patterns established here.
