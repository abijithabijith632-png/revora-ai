# Lead Management & Qualification (Phases 7–8)

Production-ready Lead Management Core. Built on the Phase 3 `leads` table and
the Phase 6 API foundation. No fake AI scores and no external API key.

## Data model

- `leads`: tenant-owned lead records. `first_name` + `last_name` are the
  canonical structured identity; `full_name` is kept in sync by the service
  layer for backward compatibility.
- `lead_status_history`: append-only status timeline. Every status change
  (including initial creation) inserts one row.
- `lead_assignments`: append-only owner assignment history.

`lead_source` enum includes all Track A sources plus legacy values.

## API

All routes require an authenticated session and a `leads.*` permission.
Tenant (`organization_id`) is always derived from the session, never the client.

### List leads

```
GET /api/leads
```

Query params:

| Param | Values | Notes |
| --- | --- | --- |
| `page` | positive int | default 1 |
| `pageSize` | 1–100 | default 20 |
| `search` | string | matches name, email, company, phone, lead number |
| `status` | lead status | combinable |
| `source` | lead source | combinable |
| `sortBy` | createdAt, updatedAt, fullName, companyName, status, source | allowlist |
| `sortOrder` | asc / desc | default desc |

Response: `{ success, data: Lead[], message, meta: { page, pageSize, total, totalPages } }`.

### Create lead

```
POST /api/leads
```

Body (all fields optional except `firstName`): `firstName`, `lastName`,
`email`, `phone`, `alternatePhone`, `companyName`, `industry`, `companySize`,
`geography`, `website`, `source`, `status`, `ownerId`, `budget`,
`expectedClosingDate`, `interestedProduct`, `notes`.

### Get lead

```
GET /api/leads/:id
```

Returns the lead plus `statusHistory`.

### Update lead

```
PATCH /api/leads/:id
```

Partial update. If `ownerId` changes, an assignment history entry and audit
record are written.

### Change status

```
PATCH /api/leads/:id/status
```

Body: `{ status, notes? }`. Writes a `lead_status_history` entry and a
`status_change` audit record.

### Assign owner

```
PATCH /api/leads/:id/assign
```

Body: `{ ownerId: string | null }`. Writes `lead_assignments` + audit.

### Archive lead

```
DELETE /api/leads/:id
```

Soft-deletes (`is_deleted = true`, `deleted_at = now()`).

### Export

```
GET /api/leads/export?format=csv|xlsx|pdf&search=&status=&source=&sortBy=&sortOrder=
```

Requires `leads.export`. Rate-limited (20 req/min). Returns a file download.
Supports CSV, XLSX (ExcelJS), and PDF (PDFKit). Capped at 10,000 rows.

## Permissions

| Action | Permission | Roles |
| --- | --- | --- |
| List / detail | `leads.view` | all roles |
| Create | `leads.create` | all roles |
| Edit / status | `leads.edit` | all roles |
| Archive | `leads.delete` | Super Admin, Admin |
| Export | `leads.export` | Super Admin, Admin, Sales Manager |
| Assign | `leads.assign` | Super Admin, Admin, Sales Manager |

## Lifecycle (Phase 8)

Controlled lifecycle states: `new`, `contacted`, `qualified`, `unqualified`,
`converted`, `lost`. Transitions are centralized in
[`lib/leads/lifecycle.ts`](../lib/leads/lifecycle.ts) and enforced server-side.

### Default flow

```
New → Contacted → Qualified → Converted
            ↘ Unqualified / Lost
```

`contacted → qualified` requires a completed qualification assessment with
outcome `qualified`. Invalid transitions (e.g. `converted → new`) are rejected.

### Transition API

```
PATCH /api/leads/:id/status
Body: { status, notes?, reason? }
```

## Qualification (Phase 8)

Seven structured criteria, three outcomes (`qualified`, `partially_qualified`,
`unqualified`), manual assessment (no AI), with full history.

### Qualification API

```
GET  /api/leads/:id/qualification   → latest + history
POST /api/leads/:id/qualification   → create assessment (optionally apply transition)
```

`POST` body includes the 7 criteria, `decisionMakerName`,
`decisionMakerDesignation`, `outcome`, optional `reason`, `notes`, and
`applyTransition`.

### Outcomes

- `qualified` — ready for client/opportunity creation (Phase 11).
- `partially_qualified` — requires nurturing.
- `unqualified` — requires a controlled disqualification reason.

## AI state

`ai_score`, `ai_score_category`, `ai_score_confidence` remain `null` until
Phase 9 (AI scoring). The UI renders "Not scored yet" when `ai_score` is null.
No fabricated AI data is ever persisted or displayed.
