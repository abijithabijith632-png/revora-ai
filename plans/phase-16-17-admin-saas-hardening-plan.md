# Phase 16–17 — Admin, SaaS/Billing, Platform Telemetry & Final Hardening

## Scope
Phase 16 builds the administrative + SaaS layer. Phase 17 is production
hardening, auditing, and the final Track A requirement audit. Phases 1–15 are
COMPLETE and must not be rebuilt — only extended.

---

## Key architectural decisions (reviewed against existing code)

1. **Reuse, don't rebuild.** Existing RBAC, tenant repositories, audit
   (`lib/api/audit.ts`), notification engine, email/AI provider abstractions,
   and `organizations` / `organizationSettings` / `plans` / `subscriptions` /
   `pipelineStages` tables are extended — never duplicated.

2. **Custom lead statuses & sources → varchar conversion.** The current
   `leads.source` and `leads.status` (and `leadStatusHistory.from_status` /
   `to_status`) are PostgreSQL enums, which cannot be tenant-extended cleanly.
   We convert them to `varchar` (data-preserving `USING col::text`), keep the
   enum values as the canonical *system* set, and add tenant-configurable
   `leadStatusConfigs` / `leadSourceConfigs` tables. Server-side validation
   accepts `system set ∪ org-active custom set`. Existing rows and all Phase 7
   smoke tests remain valid.

3. **Platform admin is separated from org admin.** A `users.isPlatformAdmin`
   boolean flag gates platform telemetry/health routes. It is NOT exposed via
   org user-admin UI and is NOT part of the org RBAC matrix.

4. **Honest external integrations.** AI / email / payment use provider
   abstractions with `isConfigured()`. No fake success. Payment never stores
   card/CVV data (provider references only).

5. **Feature gating is server-side.** A central entitlement helper checks
   plan → feature → usage before sensitive operations; UI only reflects it.

---

## Phase 16 implementation plan

### 16A — Schema & permission foundation (migration `0009`)
- `enums.ts`: add `subscriptionStatusEnum` (trial/active/past_due/cancelled/
  expired), `invitationStatusEnum` (pending/accepted/expired/revoked),
  `invoiceStatusEnum` (draft/issued/paid/void), `paymentStatusEnum`
  (pending/succeeded/failed/refunded).
- `organizations.ts`: add `description`, `website`, `industry`, `contactEmail`,
  `contactPhone`, `address`.
- `users.ts`: add `department`, `designation`, `isPlatformAdmin` (boolean
  default false).
- Convert `leads.source`, `leads.status`, `leadStatusHistory.from_status`,
  `leadStatusHistory.to_status` → `varchar`.
- New `leadStatusConfigs` + `leadSourceConfigs` (tenant-scoped config tables).
- New `invitations` table (secure token hash, expiry, email, role, status).
- New `invoices` + `payments` tables (billing records; no card data).
- `organizationSettings`: add `integrationPreferences` (jsonb).
- `lib/permissions`: add resources `billing`, `platform`, `lead_statuses`,
  `lead_sources`, `invitations`, `audit_logs` (already present); update
  `ROLE_PERMISSION_MATRIX` (Admin/Super Admin billing + config; platform kept
  out of matrix).

### 16B — SaaS/billing definitions + feature gating (`lib/billing/`)
- `plans.ts` — centralized FREE / STARTER / PROFESSIONAL / ENTERPRISE
  definitions with limits (userSeats, leadStorage, aiUsage, advancedReports,
  integrations).
- `entitlements.ts` — feature → required plan map.
- `feature-gate.ts` — `checkEntitlement()` server helper.
- `subscription-status.ts` — centralized status definitions + transitions.
- `usage.ts` — real-data usage computation.

### 16C — Repositories + services (`server/`)
- `repositories/organizations.ts` (org profile + settings).
- `repositories/lead-config.ts`, `repositories/pipeline-config.ts`,
  `repositories/invitations.ts`, `repositories/billing.ts`,
  `repositories/platform.ts`.
- `services/organization-settings.ts`, `lead-config.ts`, `pipeline-config.ts`,
  `user-admin.ts`, `billing.ts`, `platform.ts`, `payment-provider.ts`
  (Noop abstraction + `server/billing/provider.ts`).

### 16D — User administration + invitations
- Extend user admin: invite, update profile/dept/designation, activate/
  deactivate/suspend, search + pagination; privilege-escalation protection
  (never self-escalate / deactivate last admin / deactivate self).

### 16E — API routes (`app/api/`)
- `/api/organization` (GET/PATCH), `/api/settings/lead-statuses` (+`[id]`),
  `/api/settings/lead-sources` (+`[id]`), `/api/settings/pipeline-stages`
  (+`[id]`), `/api/users` (+`[id]`, `[id]/status`), `/api/invitations`
  (+`[id]/accept`), `/api/billing/*` (plan/subscription/invoices/usage/
  checkout), `/api/platform/*` (overview/telemetry/health), `/api/audit-logs`.

### 16F — UI (`app/(app)/settings/*`, `components/`)
- Replace `settings` placeholder with real Organization Settings.
- Add `settings/lead-statuses`, `settings/lead-sources`, `settings/pipeline`,
  `settings/billing`, `settings/audit`, `admin/platform`.
- Enhance `settings/users` (invite + status + role + search).
- Nav additions.

### 16G — Seed + smoke test
- Seed plans, subscription, custom status/source examples, platform admin.
- `db/phase16-smoke.ts` (RBAC, tenant isolation, invitation, billing, gating,
  telemetry, health).

---

## Phase 17 implementation plan

### 17A–17H — Integration, security, performance, polish, audit
- `db/phase17-e2e-smoke.ts` — full CRM workflow (org → invite → lead → assign
  → qualify → convert → contact → opportunity → pipeline → follow-up → task →
  meeting → proposal → email → document → won → analytics → AI → notification
  → audit → export).
- `db/phase17-multitenant-smoke.ts` — org A vs org B isolation across UI/API/
  search/export/documents/notifications/analytics/reports/settings/billing.
- Security audit: direct API calls, IDOR, privilege escalation, secret exposure.
- Performance: pagination on all new lists, indexes on new tables, no N+1.
- UI polish: loading/empty/error/success states, dark/light, responsive.
- `docs/FINAL_REQUIREMENT_AUDIT.md` — every Track A requirement classified
  IMPLEMENTED or INTEGRATION-READY (with required env vars + steps).
- `plans/phase-16-17-final-report.md` — full completion report.

---

## Validation gates
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run db:generate -- --custom` → author `0009_*.sql` → `npm run db:migrate`.
- Full regression: leads → qualification → ai-score → assignment → clients →
  conversion → opportunities → phase13 → phase14 → phase15 → phase16 →
  phase17-e2e → phase17-multitenant.

---

## External credentials (integration-ready, never faked)
| Integration | Provider | Env var(s) | Status |
|---|---|---|---|
| AI | Groq (OpenAI-compatible) | `AI_PROVIDER_API_KEY` | configured in `.env` |
| Email | SMTP/Resend/SendGrid | `EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY` | config-required |
| Payment | Stripe (provider abstraction) | `PAYMENT_PROVIDER`, `PAYMENT_PROVIDER_API_KEY` | config-required |
