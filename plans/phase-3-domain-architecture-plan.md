# Revora AI — Phase 3 Plan: Complete PostgreSQL Domain Architecture

## Approach
Extend the existing Drizzle schema (do NOT rebuild). Reuse `db/index.ts` pooled client and `common.ts` conventions. Add one schema per logical domain group (minimal file sprawl), centralize fixed states as native PostgreSQL enums, and use lookup tables only where tenant-configurable (pipeline stages).

## Schema Groups (new files under db/schema/)

### enums.ts (single source of truth for fixed states)
lead_status, lead_source, lead_qualification_status, client_status, task_status, task_priority, followup_status, followup_channel, meeting_status, proposal_status, activity_type, communication_type, notification_type, document_type, insight_type, organization_status, user_status.

### core.ts
- Extend `organizations` (add `status`)
- Extend `users` (add `status`, `last_login_at`, `avatar_url`, `job_title`; drop string `role`)
- `roles`, `permissions`, `role_permissions`, `user_roles` (RBAC)
- `organization_settings` (1:1 with org)
- `audit_logs`

### sales.ts
- `leads` (full Track A model + AI-ready score fields)
- `lead_qualifications`
- `lead_assignments` (assignment history)
- `clients`
- `contacts`

### opportunities.ts
- `opportunities`
- `pipeline_stages` (tenant-configurable)
- `opportunity_stage_history`

### operations.ts
- `activities` (polymorphic links)
- `tasks`
- `followups`
- `meetings`, `meeting_participants`
- `proposals`
- `communications`
- `documents`
- `notifications`

### ai.ts
- `ai_insights` (persistent explainability: reasons/signals as JSONB)
- `ai_insight_feedback`
- `ai_prediction_history` (changing predictions over time)

### saas.ts
- `plans`, `subscriptions` (domain foundation only, no payments)

## Conventions
- UUID PKs, `organization_id` FK (restrict) on every tenant table, `created_at`/`updated_at`, `deleted_at` only where business-appropriate (leads, clients, contacts, opportunities, documents).
- Indexes: tenant + email/phone/status/owner/created_at + FK lookup columns.
- Unique constraints tenant-scoped (org+email, org+slug, org+lead_number).

## TypeScript Domain Types
Export Drizzle `$inferSelect`/`$inferInsert` types from each schema file and a single `types/domain/index.ts` re-export barrel (no duplication).

## Repository
Enhance `server/repositories/base.ts` with a `TenantRepository` base carrying `organizationId` + a `scope()` helper for server-side tenant isolation.

## Seed
Rewrite `db/seed/index.ts` with fictional-but-consistent org → users → roles → leads → clients → contacts → opportunities → stages → tasks → activities → meetings → AI insights.

## Validation
- `npm run db:generate` → `npm run db:migrate` against real local PostgreSQL
- `npm run db:seed`
- Representative queries verifying FKs, tenant scoping, constraints
- `npm run typecheck`, `npm run lint`, `npm run build`

## Deferred (later phases)
Auth (P4), RBAC enforcement (P5), lead CRUD (P7), AI algorithms, duplicate detection, assignment engine, proposal/doc/email workflows, analytics, SaaS billing.
