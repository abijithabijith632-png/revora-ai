# Revora AI — Phase 1 Foundation Plan

## 1. Project State

- Workspace is **completely empty** — no existing code to preserve.
- Toolchain confirmed: Node.js, npm, PostgreSQL, TypeScript.

## 2. Locked Stack & Justified Additions

**Locked core:** Next.js (frontend + backend) + PostgreSQL.

**Minimal, standard dependencies (all centered on Next.js + PostgreSQL):**

| Dependency | Purpose | Justification |
|---|---|---|
| TypeScript | Type safety, maintainability | Required by acceptance criteria |
| Tailwind CSS v4 | Design system / theming | Standard Next.js styling; tokens via CSS variables |
| Drizzle ORM + `drizzle-kit` | PostgreSQL schema + migrations | Type-safe DB access + migration strategy (not a second database) |
| `pg` (node-postgres) | PostgreSQL driver | Canonical driver used by Drizzle |
| Zod | Runtime validation | Server + client validation foundation |
| `next-themes` | Light/dark theme | Minimal, standard theme switching |
| `lucide-react` | Consistent iconography | Tree-shakeable icon set |

**Deliberately NOT added:** Three.js or any 3D framework (locked out), no separate backend, no second DB, no framer-motion (micro-interactions via CSS), no auth library yet (Phase 1 = foundation only).

## 3. Key Architecture Decisions

1. **App Router** (`app/`) — modern Next.js convention, RSC-first.
2. **Server Components by default**; `"use client"` only for interactive leaf components.
3. **Drizzle ORM** for schema/migrations — TypeScript-first, no codegen, minimal runtime.
4. **Design tokens** defined once as CSS variables + Tailwind `@theme`, consumed everywhere (no hardcoded colors).
5. **Multi-tenant** via `organization_id` on all future tenant-owned tables; tenant context abstraction in `lib/tenant`; isolation enforced server-side (RLS/query scoping in later phases).
6. **API conventions** in `lib/api` (success/error envelopes) + `lib/errors` (typed error classes).
7. **Validation** centralized in `lib/validation` (Zod) shared between server and client.
8. **AI abstraction** in `services/ai` with explainable-result types (no fake algorithms).
9. **3D visual direction** reserved for high-value areas, implemented with pure CSS (AI orb) — no 3D framework.

## 4. Target Project Structure

```
app/
  (auth)/            login, register, forgot-password
  dashboard/
  leads/             new/, [id]/
  clients/           [id]/
  contacts/
  opportunities/     [id]/
  pipeline/
  activities/
  tasks/
  meetings/
  ai-assistant/
  analytics/
  documents/
  notifications/
  settings/
  profile/
  api/health/
  layout.tsx  page.tsx  globals.css  loading.tsx  error.tsx  not-found.tsx  providers.tsx
components/
  ui/                Button, Card, Badge, Input, Skeleton, etc.
  layout/            AppShell, Sidebar, Topbar, ThemeToggle
  dashboard/         hero + stats placeholders
  ai/                AiOrb (CSS 3D visual)
lib/
  auth/  validation/  permissions/  tenant/  errors/  api/  utils.ts
server/
  services/  repositories/
db/
  index.ts  schema/  migrations/  seed/
services/
  ai/               types.ts (explainable result), index.ts (abstraction)
types/
  api/  domain/
utils/
config/
  env.ts            server-only + client-safe env
public/
docs/
  ARCHITECTURE.md  DEVELOPMENT_RULES.md
drizzle.config.ts  next.config.ts  tsconfig.json  package.json
.env.example  .env.local  .gitignore  README.md
```

## 5. Database Foundation (Phase 1 scope)

- Connection + migration strategy established (Drizzle + `drizzle-kit`).
- **Only two foundational entities** created to prove the strategy:
  - `organizations` (tenant root)
  - `users` (belongs to an organization via `organization_id`)
- Conventions established: UUID PKs, `created_at`/`updated_at`, FK conventions, indexes, soft-delete pattern, `organization_id` tenant ownership.
- Remaining entities (leads, clients, contacts, opportunities, etc.) are **architecturally prepared but NOT created** in Phase 1.

## 6. Standard API Response Envelope

```jsonc
// success
{ "success": true, "data": ..., "message": "...", "meta": ... }
// error
{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }
```

## 7. Explainable AI Result Type (locked requirement)

```ts
interface ExplainableAiResult<T> {
  result: T;
  score?: number;
  confidence?: number;
  reasons: string[];
  positiveSignals: string[];
  riskSignals: string[];
  supportingData?: unknown;
  recommendation?: string;
}
```

## 8. Out of Scope (Phase 1)

Lead/client/opportunity CRUD, AI scoring, assignments, duplicate detection, pipeline logic, tasks, meetings, proposals, email, documents, notifications, analytics, forecasting, billing, telemetry. These are later phases — only placeholders/routes here, no fake data.

## 9. Acceptance Criteria (summary)

Runs cleanly, no TS/lint/build errors, `.env.example` present, no hardcoded secrets, clean architecture, route foundation, API/error/validation conventions, DB migration strategy, multi-tenant + security + AI foundations, premium light/dark design system, responsive + accessible + micro-interaction + CSS-3D foundations, README + dev rules, no unrelated features, no duplicate architecture, no unauthorized tech.
