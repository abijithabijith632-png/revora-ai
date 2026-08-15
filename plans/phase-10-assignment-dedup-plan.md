# Phase 10 — Lead Assignment + Deduplication

## Objective

Add a deterministic, explainable Lead Assignment Engine (4 strategies) and a
Duplicate Detection + safe-merge system, reusing Phases 1–9. No AI, no new
infrastructure.

## Existing assets reused

- [`leadAssignments`](db/schema/sales.ts:166) — assignment history (extended).
- [`LeadService.assign`](server/services/leads.ts:281) — manual assignment.
- [`app/api/leads/[id]/assign/route.ts`](app/api/leads/[id]/assign/route.ts:1).
- Phase 5 RBAC (`leads.assign`), Phase 6 API/audit, Phase 2 UI.

## Schema changes (minimal migration)

- `leadAssignments`: add `previousOwnerId` (uuid, set null) + `reason` (text).
- `leads`: add `mergedIntoId` (uuid, self-ref set null) for dedup traceability.
- New `userSkills` — `id, organizationId, userId, skill, skillType
  (product|language|enterprise_level), proficiency (varchar 32)`.
- New `routingRules` — `id, organizationId, strategy (territory|skill),
  priority, active, conditionField, conditionValue, targetUserId`.

## Assignment strategies (centralized, deterministic)

1. Manual — manager picks an eligible executive.
2. Round-robin — least-workload eligible user (transactional advisory lock,
   no Redis).
3. Territory — routingRules match on geography/industry/company_size by
   priority.
4. Skill — routingRules + userSkills match on product/language/enterprise.

Eligibility: same org, active status, `leads.assign`-receiving role (Sales
Executive / Sales Manager), not suspended.

## Duplicate detection + merge

- Detect by normalized email OR phone within tenant, excluding archived.
- Safe merge: `POST /api/leads/:id/merge` with `targetLeadId` — duplicate is
  soft-deleted, `mergedIntoId` set; assignment/qualification/history preserved;
  canonical lead retains owner.

## APIs

- `POST /api/leads/:id/assign` (existing) — extend for `strategy` + `reason`.
- `POST /api/leads/:id/assign/auto` — round_robin / territory / skill.
- `GET /api/leads/assignments` — telemetry (total/pending/converted/lost/active workload per user).
- `GET /api/leads/:id/duplicates` — candidate duplicates.
- `POST /api/leads/:id/merge` — safe merge.

## UI

- Assign panel on lead detail (employee selector + strategy + reason).
- Assignment history timeline.
- Manager telemetry dashboard (`/leads/assignments`).
- Duplicate detection banner + merge confirmation.

## Files

New:
- [`server/repositories/assignment.ts`](server/repositories/assignment.ts)
- [`server/services/assignment.ts`](server/services/assignment.ts)
- [`server/services/deduplication.ts`](server/services/deduplication.ts)
- [`app/api/leads/assignments/route.ts`](app/api/leads/assignments/route.ts)
- [`app/api/leads/[id]/assign/auto/route.ts`](app/api/leads/[id]/assign/auto/route.ts)
- [`app/api/leads/[id]/duplicates/route.ts`](app/api/leads/[id]/duplicates/route.ts)
- [`app/api/leads/[id]/merge/route.ts`](app/api/leads/[id]/merge/route.ts)
- [`components/leads/lead-assignment.tsx`](components/leads/lead-assignment.tsx)
- [`components/leads/lead-duplicates.tsx`](components/leads/lead-duplicates.tsx)
- [`app/(app)/leads/assignments/page.tsx`](app/(app)/leads/assignments/page.tsx)
- [`db/assignment-smoke.ts`](db/assignment-smoke.ts)

Modified:
- [`db/schema/sales.ts`](db/schema/sales.ts), [`db/schema/users.ts`](db/schema/users.ts),
  [`lib/leads/schemas.ts`](lib/leads/schemas.ts), [`server/services/leads.ts`](server/services/leads.ts),
  [`app/api/leads/[id]/assign/route.ts`](app/api/leads/[id]/assign/route.ts),
  [`app/(app)/leads/[id]/page.tsx`](app/(app)/leads/[id]/page.tsx),
  [`components/layout/nav.ts`](components/layout/nav.ts).

## Validation

Typecheck, lint, build, `db/assignment-smoke.ts` (strategies, dedup, RBAC,
tenant isolation), regression (leads/qualification/ai-score smoke).
