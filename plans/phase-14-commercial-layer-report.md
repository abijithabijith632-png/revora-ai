# Phase 14 Completion Report — Proposals + Email + Templates + Documents

## Objective

Deliver the complete commercial communication/document layer: proposal lifecycle
management, a two-way email data model with provider abstraction, org-scoped email
templates, and a centralized document repository with versioning/access governance —
all tenant-scoped, RBAC-gated, audited, and built on the existing Phase 3 schema.

## Schema (migration `0008_stormy_pete_wisdom.sql`)

| Change | Detail |
|--------|--------|
| `proposal_status` enum | Added `expired`, `cancelled` |
| `proposals` | Added `client_id`, `owner_id`, `expiry_date`, `cancelled_at`, `view_count`, `notes` + indexes |
| NEW `proposal_events` | lifecycle history (from/to status, actor, notes, occurred_at) |
| `communications` | Added `message_id`, `thread_id`, `direction`, `recipients`, `attachments`, `opened_at`, `clicked_at` |
| NEW `email_tracking_events` | real open/click events (never fabricated) |
| NEW `email_templates` | org-scoped reusable templates (category, name, subject, body, variables, archived) |
| `documents` | Added `version`, `status`, `access_permissions` |

## Presentation + validation

- [`lib/commercial/presentation.ts`](lib/commercial/presentation.ts:1) — proposal statuses, template categories, document types/status
- [`lib/commercial/schemas.ts`](lib/commercial/schemas.ts:1) — Zod schemas shared by routes + forms

## Repositories (`server/repositories/`)

- [`proposals.ts`](server/repositories/proposals.ts:1) — CRUD + lifecycle events
- [`email-templates.ts`](server/repositories/email-templates.ts:1) — CRUD + duplicate
- [`documents.ts`](server/repositories/documents.ts:1) — CRUD + versioning/status/access

## Services (`server/services/`)

- [`proposals.ts`](server/services/proposals.ts:1) — draft→sent→viewed→accepted/rejected/expired/cancelled state machine, events, `proposal_viewed` notification, activity + audit
- [`email-templates.ts`](server/services/email-templates.ts:1) — CRUD, duplicate, archive
- [`documents.ts`](server/services/documents.ts:1) — CRUD, versioning, archive, activity + audit
- [`emails.ts`](server/services/emails.ts:1) — email records (two-way model) + tracking; outbound delivery gated behind provider
- [`../email/provider.ts`](server/email/provider.ts:1) — provider abstraction (honest: not configured → no fake sync)
- [`storage.ts`](server/services/storage.ts:1) — clean storage abstraction (no exposed paths)

## API routes

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/proposals` | GET, POST | proposals.view / create |
| `/api/proposals/[id]` | GET, PATCH, POST | view / edit / edit (status) |
| `/api/email-templates` | GET, POST | proposals.view / create |
| `/api/email-templates/[id]` | GET, PATCH, DELETE | view / edit / delete |
| `/api/email-templates/[id]/duplicate` | POST | proposals.create |
| `/api/emails` | GET, POST | proposals.view / create |
| `/api/documents` | GET, POST | documents.view / create |
| `/api/documents/[id]` | GET, PATCH, DELETE | view / edit / delete |

## UI (`components/commercial/`)

- `proposal-table.tsx`, `proposal-form.tsx`, `document-list.tsx`, `document-form.tsx`, `index.ts`

## Pages

- `/proposals`, `/proposals/new`, `/proposals/[id]`, `/documents` (replaced placeholder), `/documents/new`, `/email-templates`
- Nav: added Proposals + Email Templates to Workspace section

## Validation results

| Check | Result |
|-------|--------|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 warnings / 0 errors |
| `npm run build` | 61 routes compiled |
| `db/phase14-smoke.ts` | 17/17 passed |

## Errors fixed

1. `documentService.create` schema required `status`/`version` → provided in smoke.
2. Proposal detail page double `requireSession()` → single call.
3. Unused vars (`_input`, `_reference`, `updated`) → removed.

## Phase 15 readiness

Proposals, email, templates, and documents are complete. Phase 15 (Analytics +
Reports + AI Forecasting/Risk + Global Search) reuses the `aiInsights` /
`aiPredictionHistory` storage and the existing export builders.
