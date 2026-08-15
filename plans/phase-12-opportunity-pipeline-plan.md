# Phase 12 — Opportunity Management + Sales Pipeline

## Objective
Build Opportunity Management + Sales Pipeline on top of Phases 1–11 using the
existing Phase 3 [`opportunities`](db/schema/opportunities.ts:48) /
[`pipelineStages`](db/schema/opportunities.ts:25) /
[`opportunityStageHistory`](db/schema/opportunities.ts:89) tables. No rewrites,
no AI, no API key.

## Existing assets reused
- Phase 3 opportunity/pipeline/stage-history tables.
- Phase 5 RBAC (`opportunities.*` already defined).
- Phase 6 API/validation/audit/rate-limit.
- Phase 7 search/filter/sort/pagination + export patterns.
- Phase 11 client/contact services + conversion result.
- Phase 2 UI (tables, cards, badges, modal/drawer, states).

## Schema changes (migration `0006`)
- `pipelineStages`: add `key` (varchar 32, canonical slug: new/qualified/
  proposal/negotiation/won/lost) + `isTerminal` (boolean). Backfill from name.
- `opportunities`: add `opportunity_number` (varchar 32, unique per org).
- `opportunityStageHistory`: add `previous_probability` + `new_probability` (int).
- Indexes: opportunities `org_number` unique, `org_source`, `org_expected_close`.

## Centralized pipeline config
- [`lib/opportunities/pipeline.ts`](lib/opportunities/pipeline.ts) — canonical
  stage keys, labels, default probabilities, order, terminal flags, colors,
  allowed transitions, loss reasons, source channels.

## Services
- [`server/services/opportunities.ts`](server/services/opportunities.ts) — CRUD,
  OPP-XXX ID generation, client/owner validation, stage transition validation +
  probability snapshot + audit, weighted value helpers.
- [`server/repositories/opportunities.ts`](server/repositories/opportunities.ts)
  — tenant-scoped list/search/filter/sort/pagination, stages, history, pipeline
  summary/distribution.
- [`server/services/opportunity-export.ts`](server/services/opportunity-export.ts)
  — CSV/XLSX/PDF.

## APIs
- `GET/POST /api/opportunities`, `GET/PATCH/DELETE /api/opportunities/:id`
- `POST /api/opportunities/:id/stage` (validated transition)
- `GET /api/opportunities/export`

## UI
- Opportunities list + summary KPIs (total/weighted/won/lost).
- Opportunity detail (header, commercial, pipeline, notes, history).
- Pipeline Kanban (drag-and-drop with rollback-on-failure).
- New/edit opportunity forms.
- Reuse modal/drawer for stage transition confirmation (esp. WON/LOST).

## Files
New: `lib/opportunities/*`, `server/repositories/opportunities.ts`,
`server/services/opportunities.ts`, `server/services/opportunity-export.ts`,
API routes, `components/opportunities/*`, `db/opportunities-smoke.ts`.

Modified: `db/schema/opportunities.ts`, migration `0006`, `db/seed/index.ts`,
`app/(app)/opportunities/page.tsx`, `app/(app)/opportunities/[id]/page.tsx`,
`app/(app)/pipeline/page.tsx`.

## Validation
Typecheck, lint, build, `db/opportunities-smoke.ts`, full regression (leads/
qualification/ai-score/assignment/clients/conversion).
