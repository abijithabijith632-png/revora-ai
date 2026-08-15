# Phase 11 — Client Management + Contacts + Lead Conversion

## Objective
Build the Track A Client Management Engine, multiple-contacts-per-client, and a
transactional Qualified Lead → Client conversion flow on top of Phases 1–10.
No rewrites, no new infrastructure, no AI, no API key.

## Existing assets reused
- [`clients`](db/schema/sales.ts:203) + [`contacts`](db/schema/sales.ts:240) tables (Phase 3).
- `clientStatusEnum` (active/inactive/churned/vip) in [`enums.ts`](db/schema/enums.ts:125).
- Phase 5 RBAC (`clients.*`, `contacts.*` already in matrix).
- Phase 6 API/validation/audit/rate-limit conventions.
- Phase 7 search/filter/sort/pagination + export (CSV/XLSX/PDF).
- Phase 8 qualification (`leadQualificationStatus`), Phase 10 dedup concepts.
- [`activities`](db/schema/operations.ts:40) polymorphic links for timeline.
- Phase 2 UI design system (tables, cards, badges, modal/drawer, states).

## Schema changes (minimal migration `0005_phase11_clients`)
- `clients`: add `client_number` (varchar 32, not null), `billing_address`
  (text), `corporate_info` (text), `company_size` (varchar 64).
- Indexes:
  - unique `clients_org_number_idx` (organizationId, clientNumber)
  - partial unique `clients_org_source_lead_idx` (organizationId, sourceLeadId
    WHERE source_lead_id IS NOT NULL) → concurrency guard for conversion
  - `clients_company_idx` (organizationId, companyName)
  - `clients_customer_since_idx` (organizationId, customerSince)
- `contacts`:
  - partial unique `contacts_org_client_primary_idx` (organizationId, clientId
    WHERE is_primary = true) → one primary per client
  - `contacts_name_idx`, `contacts_phone_idx`, `contacts_primary_idx`
- Backfill existing rows with generated `client_number` values.

## Client engine
- Human-readable ID `CL-{year}-{seq}` (mirrors `LeadService.nextLeadNumber`).
- Statuses centralized in presentation layer; status change permission-protected
  + audited + tenant-scoped.
- Account manager validated to be same-org, active user.

## Contact engine
- Unlimited contacts per client; primary flag; transactional primary-swap
  (clear previous, set new, sync `clients.primaryContactId`).

## Lead → Client conversion (transactional)
- Gate: `lead.status === "qualified"` AND `lead.qualificationStatus === "qualified"`.
- Idempotency: already-converted lead returns existing client (via sourceLeadId).
- Concurrency: partial unique index on `(org, sourceLeadId)` + row lock.
- Existing-client match: company name / website / email domain / phone
  (deterministic; user confirms link vs create).
- Preserves lead history (no deletion); `clients.sourceLeadId` provides traceability.
- Mark lead `converted`, audit `lead_converted`/`client_created`/`contact_created`.

## APIs
- `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id`
- `GET /api/clients/export` (CSV/XLSX/PDF)
- `GET/POST /api/contacts`, `GET/PATCH/DELETE /api/contacts/:id`
- `GET/POST /api/leads/:id/convert` (preview + convert)

## UI
- Clients list + create/edit + detail pages.
- Contacts list page + contact form (drawer/modal) on client detail.
- Client timeline (reuses lead activities + audit).
- Conversion review dialog on qualified lead detail + converted banner link.

## Files
New:
- `lib/clients/schemas.ts`, `lib/clients/presentation.ts`
- `server/repositories/clients.ts`
- `server/services/clients.ts`, `server/services/contacts.ts`,
  `server/services/conversion.ts`, `server/services/client-export.ts`
- `app/api/clients/route.ts`, `app/api/clients/[id]/route.ts`,
  `app/api/clients/export/route.ts`, `app/api/contacts/route.ts`,
  `app/api/contacts/[id]/route.ts`, `app/api/leads/[id]/convert/route.ts`
- `components/clients/*` (table, forms, timeline, index)
- `components/leads/convert-lead-dialog.tsx`
- `db/clients-smoke.ts`, `db/conversion-smoke.ts`

Modified:
- `db/schema/sales.ts`, migration `0005`, `db/seed/index.ts`
- `app/(app)/clients/page.tsx`, `app/(app)/clients/[id]/page.tsx`
- `app/(app)/contacts/page.tsx`, `app/(app)/leads/[id]/page.tsx`

## Validation
Typecheck, lint, build, `clients-smoke`, `conversion-smoke`, and full regression
(leads/qualification/ai-score/assignment smoke suites).
