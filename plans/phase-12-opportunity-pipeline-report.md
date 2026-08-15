# Phase 12 Completion Report — Opportunity Management + Sales Pipeline

## Objective

Deliver full Opportunity Management and a server-validated Sales Pipeline on top of the
existing Phase 3 domain schema (`opportunities`, `pipelineStages`, `opportunityStageHistory`),
with tenant isolation, RBAC (`opportunities.*`), weighted pipeline value, Kanban
drag-and-drop, export, audit, and human-readable Opportunity IDs (`OPP-XXX`).

## Schema Changes

### [`db/schema/opportunities.ts`](db/schema/opportunities.ts:25)

| Table | Change |
|-------|--------|
| `pipelineStages` | Added `key` (`varchar(32)`, not null) and `isTerminal` (`boolean`, default `false`); unique index `pipeline_stages_org_key_idx` on `(organization_id, key)` |
| `opportunities` | Added `opportunityNumber` (`varchar(32)`, not null); unique index `opportunities_org_number_idx` on `(organization_id, opportunity_number)`; index `opportunities_expected_close_idx` |
| `opportunityStageHistory` | Added `previousProbability` and `newProbability` (`integer`) for probability snapshots on each transition |

### Migration

[`db/migrations/0006_phase12_opportunity_pipeline.sql`](db/migrations/0006_phase12_opportunity_pipeline.sql:1)

- `ALTER TABLE ... ADD COLUMN` for `key`, `is_terminal`, `opportunity_number`, `previous_probability`, `new_probability`.
- Backfilled `key` from `name` via `CASE` on `lower(name)` (new/qualified/proposal/negotiation/final_review/won/lost).
- Backfilled `opportunity_number` via CTE `row_number() OVER (PARTITION BY organization_id ORDER BY created_at) + 300`.
- Set `is_terminal = true` for `won`/`lost`/`closed`.
- Added unique indexes.

## Centralized Pipeline Configuration

### [`lib/opportunities/pipeline.ts`](lib/opportunities/pipeline.ts:1)

- `PipelineStageKey` union: `new | qualified | proposal | negotiation | final_review | won | lost`
- `PIPELINE_STAGES`: label, order, probability, terminal flag, badge variant per stage
- `ALLOWED_TRANSITIONS`: forward + loss-only transitions, terminal stages have no exits
- `canTransition(from, to)`: pure validator shared by server and UI
- `LOSS_REASONS` and `OPPORTUNITY_SOURCES`: typed tuples (`as const`)

## Validation

### [`lib/opportunities/schemas.ts`](lib/opportunities/schemas.ts:1)

- `createOpportunitySchema`, `updateOpportunitySchema` (partial), `opportunityStageSchema`,
  and `opportunityFilterSchema` — all Zod with `z.enum(STAGE_KEYS)` (tuple-based).

## Data Access & Services

### [`server/repositories/opportunities.ts`](server/repositories/opportunities.ts:1)

`OpportunityRepository extends TenantRepository` provides:

- `list` — search (name/description/opportunityNumber/company via raw `ILIKE`), stage filter,
  client filter, owner filter, sort, pagination; non-null `stageKey` via `coalesce`.
- `listStages`, `findStageIdByKey`, `findById`
- `create`, `update`, `archive`
- `insertStageHistory`, `stageHistory` (aliased joins via `sql\`pipeline_stages AS ps_prev\``)
- `pipelineSummary` — count, totalValue, weightedValue, wonValue, lostValue + per-stage distribution
- `exportRows`

### [`server/services/opportunities.ts`](server/services/opportunities.ts:1)

`OpportunityService`:

- `nextOpportunityNumber()` → `OPP-{year}-{seq}` (tenant-scoped, race-safe via max + 1)
- `list`, `listStages`, `pipelineSummary`, `getById`
- `create` — validates client/owner, resolves stage by key, applies default probability, writes
  stage history + audit
- `update` — validates stage transitions when stage changes
- `changeStage` — server-validated transition via `canTransition`, loss requires reason,
  won/lost set `closedAt`/`closedReason`, transactional stage history with probability
  snapshots, audit
- `archive`, `exportRows`

### [`server/services/opportunity-export.ts`](server/services/opportunity-export.ts:1)

CSV/XLSX/PDF export for opportunity rows (mirrors the lead/client export pattern).

## API Routes

| Route | Methods | Permission |
|-------|---------|------------|
| [`app/api/opportunities/route.ts`](app/api/opportunities/route.ts:1) | GET, POST | view, create |
| [`app/api/opportunities/[id]/route.ts`](app/api/opportunities/[id]/route.ts:1) | GET, PATCH, DELETE | view, edit, delete |
| [`app/api/opportunities/[id]/stage/route.ts`](app/api/opportunities/[id]/stage/route.ts:1) | POST | edit |
| [`app/api/opportunities/export/route.ts`](app/api/opportunities/export/route.ts:1) | GET | export |

All routes use `requireApiContext(permission)`, `parseBody`/`parseAndValidate`, standard
envelope, `recordAudit`, and `checkRateLimit`.

## UI

### Components — [`components/opportunities/`](components/opportunities/index.ts:1)

- [`opportunity-table.tsx`](components/opportunities/opportunity-table.tsx:1) — list with
  search, stage filter, export, pagination, `formatMoney`
- [`opportunity-form.tsx`](components/opportunities/opportunity-form.tsx:1) — create/edit form
  with client selector, amount, probability, stage, source, product/service, description, notes
- [`opportunity-kanban.tsx`](components/opportunities/opportunity-kanban.tsx:1) — HTML5
  drag-and-drop with optimistic update + rollback on failure

### Pages

- [`app/(app)/opportunities/page.tsx`](app/(app)/opportunities/page.tsx:12) — list + KPIs
  (total, weighted, won, open count)
- [`app/(app)/opportunities/[id]/page.tsx`](app/(app)/opportunities/[id]/page.tsx:26) — detail,
  stage history, next-stage transition actions
- [`app/(app)/opportunities/new/page.tsx`](app/(app)/opportunities/new/page.tsx:1) and
  [`app/(app)/opportunities/[id]/edit/page.tsx`](app/(app)/opportunities/[id]/edit/page.tsx:1)
- [`app/(app)/pipeline/page.tsx`](app/(app)/pipeline/page.tsx:11) — Kanban board

### [`lib/money.ts`](lib/money.ts:1)

`formatMoney(amount, currency = "INR", locale = "en-IN")` via `Intl.NumberFormat` (no hardcoded
currency symbol).

## Seed

[`db/seed/index.ts`](db/seed/index.ts:1) updated: `pipelineStages` now carry `key` + `isTerminal`;
seeded opportunities carry `opportunityNumber: "OPP-301"` / `"OPP-302"`.

## Smoke Tests

[`db/opportunities-smoke.ts`](db/opportunities-smoke.ts:1) — **17/17 passed**

Covers: RBAC (`opportunities.*`), OPP ID generation, default probability, search, valid/invalid
transitions, loss reason requirement, stage history with probability snapshots, pipeline summary
weighted value, tenant isolation, and pure `canTransition` validation.

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 warnings / 0 errors |
| `npm run build` | 53 routes compiled |
| `db/opportunities-smoke.ts` | 17/17 passed |
| Full regression (Phases 7–11) | leads 19/19, qualification 14/14, ai-score 17/17, assignment 18/18, clients 7/7, conversion 8/8 |

## Errors Fixed During Implementation

1. **Window functions in UPDATE** (migration backfill) → CTE + `UPDATE ... FROM`.
2. **`ilike(character varying, unknown)`** → raw SQL with `::uuid` cast + `ILIKE` operator.
3. **`pipelineStages.as("alias")` unavailable** → `sql\`pipeline_stages AS ps_prev\`` in `leftJoin`.
4. **`z.enum` tuple requirement** → `const STAGE_KEYS = [...] as const`.
5. **Nullable `stageKey` from leftJoin** → `coalesce` in select + `?? "new"` fallback.
6. **`stageId` nullability in update patch** → signature widened to `string | null`.
7. **Unused imports/vars** (`ConflictError`, `stageRows`, `rows`) → removed.

## Phase 13 Readiness

Phase 12 leaves the domain fully ready for Phase 13 (follow-ups, tasks, meetings, and the
opportunity activity timeline): the `activities` polymorphic table already links
`opportunity_id`, and opportunity detail pages already render stage history — the natural
extension point for activity timelines.
