# Revora AI — Phases 13–17 Master Implementation Plan

> **Scope note:** Phases 13, 14, and 15 are fully specified in the master prompt and
> are planned below in full. **Phase 16 and Phase 17 specifications were never
> provided** (the master prompt ended mid-list at "15.12 PHASE 15 TESTING" with no
> Phase 16/17 content). They are **BLOCKED** and will be planned only once their
> specs are supplied. Per the NO-REWORK / NO-DUPLICATION rules, we will NOT invent
> their scope.

---

## Guiding constraints (already established)

- Locked stack: Next.js + TypeScript + PostgreSQL + Drizzle ORM. No new backend/DB.
- Tenant isolation: `organization_id` always resolved server-side from the session.
- RBAC: reuse [`ROLE_PERMISSION_MATRIX`](lib/permissions/index.ts:73). UI hiding is never security.
- Reuse: `TenantRepository`, `BaseService`, `requireApiContext`, `recordAudit`,
  `checkRateLimit`, standard `success`/`failure` envelopes, `parsePagination`,
  `parseSort`, `parseFilters`, Zod, export builders (ExcelJS/PDFKit), UI primitives.
- Honesty: no fabricated AI predictions, no fake email sync, no invented signals.

---

# PHASE 13 — Activities + Follow-ups + Tasks + Meetings + Notifications

## 13A. Schema extension (migration `0007_phase13_execution_layer.sql`)

Existing tables already cover most of the model. Extend minimally:

| Table | Change | Rationale |
|-------|--------|-----------|
| `followups` | ADD `action_description` text | PRD requires an explicit "Action Description" (distinct from free-form notes) |
| `meetings` | ADD `action_items` jsonb | PRD requires meeting "action items" |
| `meetings` | ADD `lead_id` uuid (FK leads) | meetings must link to lead context when applicable |
| `notifications` | (no column change) | existing type/related-entity model is sufficient |
| NEW `user_notification_preferences` | per-user preferences | PRD requires notification preferences; org-level jsonb exists but is not user-scoped |
| `notification_type` enum | ADD `important_deal_update`, `assignment` | PRD explicitly lists these types |

`user_notification_preferences` columns: `id`, `organization_id`, `user_id`,
`email_enabled`, `in_app_enabled`, `types` (jsonb — map of type → enabled),
`created_at`, `updated_at`; unique index on `(user_id)`.

## 13B. `lib/operations/presentation.ts`

Centralized label/variant maps for:
- activity types (`call/email/meeting/note/proposal/follow_up/task/payment/status_change`)
- task status (`pending/in_progress/completed/overdue/cancelled`)
- followup status (`pending/completed/skipped/overdue/cancelled`) + channel (`email/phone/whatsapp/sms/meeting/other`)
- meeting status (`scheduled/completed/cancelled/rescheduled`)
- notification types + icons

## 13C. `lib/operations/schemas.ts`

Zod schemas (shared server/client), mirroring enum values:

- `createActivitySchema`, `updateActivitySchema`, `activityFilterSchema`
- `createTaskSchema`, `updateTaskSchema`, `taskStatusSchema`, `taskFilterSchema`
- `createFollowupSchema`, `updateFollowupSchema`, `followupStatusSchema`, `followupFilterSchema`
- `createMeetingSchema`, `updateMeetingSchema`, `meetingStatusSchema`, `meetingFilterSchema`
- `notificationPreferencesSchema`

## 13D. Repositories (extend `TenantRepository`)

- `server/repositories/activities.ts` — `ActivityRepository`
  - `list` (unified feed: search, entity filter, type filter, pagination)
  - `listTimeline(entityType, entityId)` — polymorphic timeline for client/opportunity
  - `create`, `update`, `archive`, `findById`, `findIdByOrg`
- `server/repositories/tasks.ts` — `TaskRepository` (list/search/filter/sort/pagination, CRUD, complete, reassign)
- `server/repositories/followups.ts` — `FollowupRepository` (CRUD, `listReminders` today/upcoming/overdue)
- `server/repositories/meetings.ts` — `MeetingRepository` (CRUD + participants + action items)
- `server/repositories/notifications.ts` — `NotificationRepository`
  - `listForUser`, `unreadCount`, `markRead`, `markAllRead`, `create`, preferences CRUD

## 13E. Services (extend `BaseService`)

- `server/services/activities.ts` — CRUD + `recordActivity` (helper used by other
  services to write into the unified timeline on followup/task/meeting/status events)
- `server/services/tasks.ts` — CRUD, complete (sets `completedAt`), reassign,
  emits `task_due` notification when due soon; writes `activities` type `task`
- `server/services/followups.ts` — CRUD, `reminders()` (today/upcoming/overdue from
  real PostgreSQL rows), emits `follow_up_overdue` notifications; writes activities
- `server/services/meetings.ts` — CRUD + participants, `actionItems`, emits
  `meeting_reminder`; writes activities
- `server/services/notifications.ts` — centralized engine:
  - `notify({userId, type, title, message, entityType, entityId})` — single code path
  - `list`, `unreadCount`, `markRead`, `markAllRead`, `preferences`
  - respects user preferences (`in_app_enabled`, `types`) before inserting

## 13F. API routes

| Route | Methods | Permission |
|-------|---------|------------|
| `/api/activities` | GET, POST | activities.view / create |
| `/api/activities/[id]` | GET, PATCH, DELETE | view / edit / delete |
| `/api/tasks` | GET, POST | tasks.view / create |
| `/api/tasks/[id]` | GET, PATCH, DELETE | view / edit / delete |
| `/api/tasks/[id]/complete` | POST | tasks.edit |
| `/api/followups` | GET, POST | activities.view / create (or tasks.create) |
| `/api/followups/[id]` | GET, PATCH, DELETE | view / edit / delete |
| `/api/followups/reminders` | GET | activities.view |
| `/api/meetings` | GET, POST | meetings.view / create |
| `/api/meetings/[id]` | GET, PATCH, DELETE | view / edit / delete |
| `/api/notifications` | GET | notifications.view |
| `/api/notifications/unread-count` | GET | notifications.view |
| `/api/notifications/[id]/read` | POST | notifications.view |
| `/api/notifications/read-all` | POST | notifications.view |
| `/api/notifications/preferences` | GET, PATCH | notifications.view |

All use `requireApiContext`, `parseBody`, `parsePagination`/`parseSort`/`parseFilters`,
`recordAudit`, and `checkRateLimit` on mutating endpoints.

## 13G. UI components (`components/operations/`)

- `activity-timeline.tsx` — unified timeline (shared by client/opportunity detail)
- `activity-form.tsx` — log call/email/note/meeting/etc.
- `task-list.tsx`, `task-form.tsx`
- `followup-list.tsx`, `followup-form.tsx`
- `meeting-list.tsx`, `meeting-form.tsx`
- `notification-center.tsx` — drawer/page with bell + unread badge, mark read/all
- `index.ts` barrel

## 13H. Pages + integration

- Replace placeholder pages: `/activities`, `/tasks`, `/meetings`, `/notifications`
- Add follow-up reminder section to `/activities` (or dedicated reminders card)
- Integrate `activity-timeline` into [`app/(app)/clients/[id]/page.tsx`](app/(app)/clients/[id]/page.tsx:26)
  and [`app/(app)/opportunities/[id]/page.tsx`](app/(app)/opportunities/[id]/page.tsx:26)
- Wire notification bell into [`components/layout/topbar.tsx`](components/layout/topbar.tsx:1)
  (unread badge + link to `/notifications`)

## 13I. Seed + smoke + regression

- Seed: followups (with `actionDescription`), meetings (with `actionItems`),
  user notification preferences, sample notifications, richer activities
- `db/phase13-smoke.ts` — activity CRUD, followup CRUD + reminders, task CRUD +
  complete/reassign, meeting CRUD + participants, notification create/read/unread,
  preferences, RBAC (least privilege), tenant isolation, timeline integration
- Full regression (Phases 7–12)

---

# PHASE 14 — Proposals + Email + Templates + Documents

## 14A. Schema extension (migration `0008_phase14_commercial_layer.sql`)

| Table | Change | Rationale |
|-------|--------|-----------|
| `proposal_status` enum | ADD `expired`, `cancelled` | PRD requires these statuses |
| `proposals` | ADD `client_id` uuid FK clients, `owner_id` uuid FK users, `notes` text, `expiry_date` timestamptz, `cancelled_at` timestamptz, `view_count` integer default 0 | PRD fields (Client, Owner, Notes, Expiry Date) |
| NEW `proposal_events` | lifecycle history | PRD: record Created/Sent/Viewed/Accepted/Rejected/Expired/Cancelled |
| `communications` | ADD `message_id` varchar, `thread_id` varchar, `direction` varchar, `recipients` jsonb, `attachments` jsonb, `opened_at`, `clicked_at` | PRD two-way email model + tracking readiness |
| NEW `email_templates` | org-scoped reusable templates | PRD categories + CRUD/duplicate/archive |
| `documents` | ADD `version` integer default 1, `status` varchar, `access_permissions` jsonb | PRD version/status/access governance |
| NEW `email_tracking_events` | `email_id`, `event_type` (open/click), `occurred_at`, `metadata` | real tracking events only (never fabricated) |

`email_templates` columns: `id`, `organization_id`, `category` (introduction/
follow_up/proposal_reminder/meeting_confirmation/thank_you/deal_closure/renewal),
`name`, `subject`, `body`, `variables` jsonb, `is_archived` boolean, `created_by`,
timestamps; index on `(organization_id, category)`.

## 14B. `lib/commercial/presentation.ts` + `lib/commercial/schemas.ts`

- Proposal status labels/variants; email template categories; document types/status
- Zod schemas: `createProposalSchema`, `updateProposalSchema`, `proposalStatusSchema`,
  `createEmailTemplateSchema`, `updateEmailTemplateSchema`,
  `createDocumentSchema`, `updateDocumentSchema`, `emailRecordSchema`

## 14C. Repositories + services

- `server/repositories/proposals.ts` + `server/services/proposals.ts`
  - CRUD, lifecycle state machine (draft→sent→viewed→accepted/rejected/expired/cancelled),
    event recording, timeline + notification + audit integration
- `server/repositories/email-templates.ts` + `server/services/email-templates.ts`
  - org-scoped CRUD, duplicate, archive, variable rendering
- `server/repositories/communications.ts` + `server/services/emails.ts`
  - store email records (messageId/threadId/recipients/attachments), direction sent/received
  - **provider abstraction only** (`server/email/provider.ts`) — no fake live sync;
    clearly report Gmail/Outlook credential requirement when unconfigured
- `server/repositories/documents.ts` + `server/services/documents.ts`
  - CRUD, version, status, access governance, download/preview metadata
- `server/services/storage.ts` — clean storage abstraction (no encrypted-external-storage
  pretense; local/object-store adapter seam)

## 14D. API routes

- `/api/proposals`, `/api/proposals/[id]`, `/api/proposals/[id]/status`
- `/api/email-templates`, `/api/email-templates/[id]`, `/api/email-templates/[id]/duplicate`
- `/api/emails`, `/api/emails/[id]`
- `/api/documents`, `/api/documents/[id]`
- All RBAC-gated (`proposals.*`, `documents.*`, `notifications.*` for events)

## 14E. UI + pages

- `components/commercial/` — proposal form/table/timeline, email template list/editor,
  document upload/list, email record list
- Pages: `/proposals`, `/proposals/[id]`, `/email-templates`, `/documents`
  (replace [`app/(app)/documents/page.tsx`](app/(app)/documents/page.tsx:1) placeholder)
- Integrate proposal lifecycle into opportunity + client timelines

## 14F. Seed + smoke + regression

- `db/phase14-smoke.ts` — proposal lifecycle, email records, template CRUD/duplicate,
  document CRUD + permissions, tenant isolation, RBAC, audit, notifications, regression

---

# PHASE 15 — Analytics + Reports + AI Forecasting/Risk + Global Search

## 15A. Global search (`server/repositories/search.ts` + `server/services/search.ts`)

- Single tenant-scoped search across leads, clients, contacts, opportunities, tasks,
  meetings, activities, documents
- Parameters: name/email/company/phone/status/owner/date/source → normalized result
  `{ entityType, id, title, subtitle, status, owner, metadata, href }`
- Server-side aggregation + pagination; no browser-side cross-table queries

## 15B. Advanced filtering (`lib/analytics/filters.ts`)

- Reusable combinable filter builder (AND across: status, location, budget range,
  team/owner, date range, source) shared by leads/opportunities/reports
- Extends existing `parseFilters` pattern; no per-page filter systems

## 15C. Executive dashboard (`server/repositories/analytics.ts` + `server/services/analytics.ts`)

- KPI cards: total/new/qualified leads, active opportunities, won/lost deals,
  total pipeline value, total revenue, conversion rate — computed via real SQL
- Visualizations (server-aggregated): leads over time, funnel breakdown, revenue
  trends, pipeline by stage, source attribution

## 15D. Sales funnel analytics

- Lead→Contacted→Qualified→Proposal→Negotiation→Won with counts, %, drop-off,
  conversion rate, bottleneck stage — derived from lead status + pipeline stage data

## 15E. Salesperson performance

- Per-owner: leads handled, conversion %, won/lost ratio, revenue, avg deal size,
  follow-up SLA compliance, initial response speed
- Role-scoped: Sales Executive sees only own data (enforce via owner filter)

## 15F. AI deal prediction / forecast / churn-risk (extend `services/ai`)

- Reuse existing [`services/ai`](services/ai/index.ts:1) provider abstraction +
  `aiInsights`/`aiPredictionHistory` storage
- `server/services/forecasting.ts`:
  - Deal win probability, expected value, estimated close time
  - Revenue forecast = confirmed revenue + weighted pipeline (monthly)
  - Churn/risk early warning from real signals (no-interaction 30+ days, expiry
    proximity, lost momentum); mark unavailable signal sources explicitly
- **Every output** includes: prediction, confidence, reasoning/explanation,
  contributing factors, data freshness/limitations (Phase 9 explainability model)
- No invented credentials; if `AI_PROVIDER_API_KEY` missing → deterministic
  explainable heuristics + explicit "AI provider not configured" report

## 15G. Reporting engine (`server/services/reporting.ts` + export reuse)

- Report areas: Leads, Sales, Pipeline, Customers
- Filters: date range, owner, team, source, status, stage
- Export CSV/XLSX/PDF via existing ExcelJS/PDFKit builders

## 15H. API routes

- `/api/search` — global search
- `/api/analytics/dashboard`, `/api/analytics/funnel`, `/api/analytics/performance`
- `/api/analytics/forecast`, `/api/analytics/deal-prediction`, `/api/analytics/risk`
- `/api/reports` + `/api/reports/export`
- RBAC: `analytics.view`, `reports.view`, `ai_insights.view`; Sales Executive scope-restricted

## 15I. UI + pages

- `/analytics` dashboard page (replace placeholder), funnel, performance, forecast, risk
- Global search dropdown in [`components/layout/topbar.tsx`](components/layout/topbar.tsx:1)
- Report pages with filter + export buttons

## 15J. Seed + smoke + regression

- `db/phase15-smoke.ts` — global search (tenant scope), filters, dashboard math,
  funnel, performance, AI predictions + explanations, risk, forecast, exports, RBAC
- Full regression

---

## Cross-cutting validation checklist (every phase)

1. `npm run typecheck` → 0 errors
2. `npm run lint` → 0 warnings
3. `npm run build` → all routes compiled
4. New smoke test passes
5. Full regression (all prior smoke tests) passes

---

## Blocked items

- **Phase 16** — specification not provided
- **Phase 17** — specification not provided

These will be appended to this plan (or a new plan) once the specs are supplied.
