# Revora AI

**AI-powered CRM and Sales Intelligence Platform** — Track A.

Revora AI is being developed incrementally through a **25-phase architecture-preserving implementation plan**. This repository currently contains **Phase 1**, the clean, scalable foundation that all subsequent phases build upon.

---

## 1. Product Purpose

Revora AI is the central source of truth for:

- customer interactions
- sales pipeline health
- revenue telemetry
- sales team activities
- AI-powered sales decisions

The full commercial lifecycle — Lead Acquisition → Qualification → Conversion → Opportunity → Follow-ups → Proposal → Negotiation → Closure → Account Management → Retention & Upselling — is implemented across the 25 phases.

---

## 2. Track A Alignment

This project targets the **Track A** multi-tenant SaaS CRM lifecycle, prioritizing explainable AI, enterprise-grade data integrity, and server-side tenant isolation.

---

## 3. Locked Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| Backend | Next.js (application/server architecture) |
| Database | PostgreSQL |

**Strictly prohibited:** separate FastAPI/Express backends, a second database, MongoDB, Firebase, Supabase-as-backend, or a second frontend app.

Minimal supporting libraries (all centered on the locked stack): TypeScript, Tailwind CSS v4, Drizzle ORM (`drizzle-kit`), `pg`, Zod, `next-themes`, `lucide-react`.

---

## 4. Local Setup

### Prerequisites

- Node.js ≥ 18.18
- npm
- PostgreSQL (running locally)

### Install

```bash
npm install
```

### Environment

```bash
# Copy the template and fill in your local PostgreSQL credentials
cp .env.example .env
```

The only required variable is `DATABASE_URL`. See [`.env.example`](.env.example).

### Database

```bash
# Generate SQL migrations from the schema
npm run db:generate

# Apply migrations
npm run db:migrate

# (optional) insert clearly-labeled development-only seed data
npm run db:seed
```

### Run

```bash
# Development
npm run dev

# Production build + start
npm run build
npm run start
```

Open http://localhost:3000.

---

## 5. Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:generate` | Generate migrations from Drizzle schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Run development-only seed |

---

## 6. Project Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full structure and design decisions.

High-level separation:

- `app/` — Next.js App Router (routes, layouts, API routes)
- `components/` — reusable UI, layout, dashboard, and AI visual components
- `lib/` — errors, API response, validation, auth, permissions, tenant context
- `server/` — services and repositories (business logic + data access)
- `db/` — schema, migrations, seed
- `services/ai/` — explainable AI service abstraction
- `types/` — shared TypeScript types (API + domain + AI)
- `config/` — environment configuration with server/client boundaries

---

## 7. Phase 1 Scope

Phase 1 delivers the foundation only:

- Next.js full-stack project structure
- PostgreSQL connection + migration strategy
- Environment configuration (`.env.example`, safe env access)
- Clean module organization
- Application routing foundation (all future routes prepared)
- API/server conventions (standard response envelope, error handling)
- Validation foundation (Zod)
- Multi-tenant architecture foundation (`organization_id`)
- Security foundation (no hardcoded secrets, server/client env boundary)
- AI-ready service abstraction (explainable results)
- Premium light/dark design system
- Responsive layout, accessibility, micro-interactions
- Purposeful CSS-only 3D visual direction

**Not implemented in Phase 1:** business CRUD, AI algorithms, authentication flows, analytics, etc. Those are later phases.

---

## 8. Future Phase Roadmap

| Domain | Status |
|---|---|
| Lead management | Planned |
| Client/contact management | Planned |
| Opportunities & pipeline | Planned |
| Tasks, meetings, activities | Planned |
| Documents & proposals | Planned |
| Notifications | Planned |
| AI lead scoring / qualification / prediction | Planned (explainable) |
| Analytics & revenue forecasting | Planned |
| Authentication & RBAC | Planned |
| SaaS billing & telemetry | Planned |

---

## 9. Important Development Rules

See [`docs/DEVELOPMENT_RULES.md`](docs/DEVELOPMENT_RULES.md). Key rules:

1. Never replace the locked stack.
2. Never create a separate backend or second database.
3. Inspect existing code before modifying; reuse existing modules.
4. Do not duplicate functionality or rewrite working code unnecessarily.
5. Do not present fake/unfinished functionality as complete.
6. Never hardcode secrets; keep AI explainable; keep animations/3D purposeful.
