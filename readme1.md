# SHE Software Solutions Sales Intelligence & CRM

This document consolidates the current project architecture, delivered capabilities, local setup, verification status, and release work still outstanding. It is based on the repository as it currently exists. It does not claim that unavailable database, API integration, or browser checks have passed.

> **Product branding:** SHE Software Solutions  
> **Application/repository identifiers:** Revora AI / `revora-ai` remain in some internal names, routes, test files, and deployment configuration.

## Project overview

The application is a multi-tenant sales CRM and sales-intelligence platform. It manages the sales lifecycle from lead capture and qualification through accounts, contacts, opportunities, pipeline, follow-up, proposals, and reporting. Server-side AI features interpret authorized CRM data and provide structured summaries, scoring explanations, recommendations, drafts, and alerts.

The stack is a single Next.js application backed by PostgreSQL. Next.js App Router pages and Route Handlers provide the UI and HTTP APIs. Drizzle ORM defines and accesses the database. Zod validates request payloads and AI outputs. The application does not use a separate backend service or second database.

## Current implementation status

Phases 1–4 are present in the current working tree. Earlier implementation work is preserved. The newest code-quality checks have passed; live integration and browser verification remain outstanding (see [Verification and remaining work](#verification-and-remaining-work)).

### Phase 1 — CRM foundation and core sales workflows

- Authentication and sessions, registration, password reset, email verification, role-based permissions, organization context, and audit infrastructure.
- Leads, lead status and qualification, assignment, conversion to clients, duplicate/data-quality workflows, and lead scoring.
- Accounts/clients, contacts, opportunities, pipeline stages and stage history.
- Activities, tasks, follow-ups, meetings, proposals, documents, email templates, and notifications.
- Analytics, dashboard, forecasting, deal-risk and sales reporting capabilities.

### Phase 2 — AI assistance and sales sequences

- Shared server-side AI provider used for structured output.
- AI copilot, email drafting, meeting summary, and conversation analysis services and routes.
- Sales sequence schema, service, UI, and API routes. Sequence email steps create drafts; they do not send email automatically.
- Lead assignment recommendations and existing assignment services.

### Phase 3 — Sales intelligence

- Account intelligence based on CRM records, including contacts, open opportunities, activity, engagement, and saved insights.
- First-party buying-intent signals, next-best-action recommendations, pipeline intelligence, deal-risk signals, and forecast explanations.
- Smart alerts, data-quality checks, sales-representative intelligence, daily priorities, and daily sales brief.
- These capabilities reuse existing CRM data and services; account research does not claim unverified external facts.

### Phase 4 — AI agents and responsive improvements

- Central agent framework with Lead, Deal, Research/Account, Follow-up, Forecast, and Meeting agents.
- Structured output validation and provider-failure fallback for agent analysis.
- Recommendations are separated from actions. Supported task, follow-up, assignment, and email-draft operations require explicit confirmation and use existing application services. Email actions create drafts only.
- Agent runs and confirmed actions use existing audit infrastructure. Agent prompts avoid unnecessary lead email exposure by sending email availability instead of the address.
- Responsive improvements to navigation, CRM tables, touch targets, forms, agent UI, and intelligence panels.

## Architecture and important locations

| Location | Responsibility |
|---|---|
| `app/` | Next.js pages, layouts, loading/error states, and API Route Handlers |
| `app/(auth)/` | Login, registration, verification, and password recovery pages |
| `app/(app)/` | Authenticated dashboard, CRM, analytics, intelligence, agents, sequences, and settings pages |
| `app/api/` | HTTP APIs grouped by CRM domain, analytics, AI, agents, auth, and sequences |
| `components/ui/` | Shared buttons, cards, forms, tables, overlays, badges, and other UI primitives |
| `components/layout/` | App shell, navigation, sidebar, and top bar |
| `components/ai/`, `components/analytics/`, `components/sequences/` | AI workspaces and visualizations, analytics UI, and sequence UI |
| `lib/auth/`, `lib/permissions/`, `lib/tenant/` | Session, authorization, and tenant context helpers |
| `lib/api/`, `lib/errors/`, `lib/validation/` | API response envelopes, request parsing, rate-limit helper, audit helper, typed errors, and validation |
| `server/ai/` | Existing AI provider, agent framework/contracts, scoring context, and buying-intent logic |
| `server/services/` | Business services for CRM, analytics, AI, sequences, and operations |
| `server/repositories/` | Reusable data-access modules for CRM domains |
| `db/schema/` | Drizzle schema definitions, including sales, operations, AI, and sequence entities |
| `db/migrations/` | PostgreSQL migration SQL and Drizzle metadata |
| `config/env.ts` | Server-only and public environment accessors |
| `tests/` | Focused Node test files for intelligence and agent contracts |
| `e2e/`, `playwright.config.ts` | Playwright end-to-end test and browser configuration |

The normal request path is:

```text
Page or API Route Handler
  → authenticate and authorize using server session
  → validate request input
  → service applies organization and record scope
  → repository/Drizzle query accesses PostgreSQL
  → standard API success/error envelope
```

## Data model summary

All principal CRM entities are PostgreSQL tables defined with Drizzle. The main groups are:

- **Identity and access:** organizations, users, sessions, auth tokens, roles, permissions, user-role assignments, role-permission assignments.
- **Sales CRM:** leads, lead status history, qualifications, assignments, clients/accounts, contacts, pipeline stages, opportunities, and opportunity-stage history.
- **Operations:** activities, tasks, follow-ups, meetings, meeting participants, communications, email templates, documents, proposals, and proposal events.
- **AI and audit:** AI insights, AI feedback, prediction history, audit logs, and sales-representative/routing data.
- **Platform:** organization settings, invitations, plans, subscriptions, invoices, payments, notifications, and notification preferences.
- **Sales sequences:** `sales_sequences`, `sales_sequence_enrollments`, and `sales_sequence_executions`, defined in `db/schema/sequences.ts` and created by `db/migrations/0011_sales_sequences.sql`.

The sequence migration is required by the sequence schema and routes. It is in the migration journal. Its declarations were statically compared with the Drizzle sequence schema and `drizzle-kit check` passed. It has **not** been applied to a test or production database in the latest hardening pass. The sequence foreign keys refer to row IDs; tenant consistency is enforced by service query scoping rather than composite organization-and-ID foreign keys. Runtime database behavior remains unverified.

## API surface

APIs follow a shared response envelope (`success`, `data`, `message`, `meta`) and typed error responses. Major route families include:

- `/api/auth/*` — authentication, sessions, registration, verification, and password recovery.
- `/api/leads/*`, `/api/clients/*`, `/api/contacts/*`, `/api/opportunities/*` — CRM CRUD and supporting workflows.
- `/api/activities/*`, `/api/tasks/*`, `/api/followups/*`, `/api/meetings/*` — sales operations.
- `/api/analytics/*`, `/api/sales-intelligence/*`, `/api/reports` — forecast, risk, pipeline, priorities, alerts, and reporting.
- `/api/ai/*`, `/api/leads/[id]/ai-score`, `/api/meetings/[id]/summary`, `/api/clients/[id]/intelligence` — existing AI and intelligence operations.
- `/api/sequences/*` — sequence management, enrollment, status, and step evaluation.
- `POST /api/agents/[agentId]` — run an authorized agent analysis.
- `POST /api/agents/actions` — validate and execute a confirmed, allowed agent action through existing services.
- `/api/notifications/*`, `/api/settings/*`, `/api/rbac/*`, `/api/billing/*` — platform capabilities.

The authenticated organization comes from the server session; client-supplied organization IDs are not the tenant authority. Agent records are checked against organization scope and, where applicable, owner/organizer or account-manager scope. API-level cross-tenant behavior still needs isolated integration testing.

## AI provider and action safety

`server/ai/provider.ts` contains the shared OpenAI-compatible provider wrapper (Groq is the default configuration). It uses server-side environment values, a request timeout, structured JSON mode, and does not expose the provider key to client components. Feature services validate structured output and provide deterministic fallbacks where supported.

Agent flow:

```text
authorized CRM context → structured recommendation → user review/confirmation
  → validated action route → existing service → audit event
```

The model is not given database or shell execution capabilities. The action schema and route allow only defined actions. Agent actions do not delete CRM records, change permissions, or send email. Provider timeouts, missing credentials, provider outages, and malformed results have **not** been simulated against an integration environment in the latest hardening pass.

## Environment and local setup

Use Node.js 18.18 or later, npm, and a PostgreSQL database intended for development. Never copy actual secret values into documentation or source control.

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and set local values. Keep `.env` and `.env.local` private and out of source control.
3. Required server configuration includes `DATABASE_URL` and `AUTH_SECRET`.
4. AI is optional; configure `AI_PROVIDER_API_KEY`, and optionally `AI_PROVIDER`, `AI_MODEL`, and `AI_BASE_URL` to enable provider-backed features.
5. `EMAIL_PROVIDER` / `EMAIL_PROVIDER_API_KEY` and `PAYMENT_PROVIDER` / `PAYMENT_PROVIDER_API_KEY` are server-side integration settings. Empty values gate those integrations; do not assume provider delivery is enabled.
6. `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_URL` are public values only. Never put secrets in `NEXT_PUBLIC_*` variables.
7. Apply migrations only to the intended development database with `npm run db:migrate`. Do not use `db:push`, seed, smoke, reset, or migration commands against production without an explicit release procedure and backup.
8. Start the local app with `npm run dev`.

`drizzle.config.ts` loads `.env.local` (overriding `.env`) for Drizzle CLI operations. Confirm the target database before running migration commands. Do not print or paste database URLs in logs or chat.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Full ESLint check |
| `npm run build` | Production build |
| `npm run start` | Serve the production build locally |
| `node --import tsx --test tests/phase3-intelligence.test.ts tests/phase4-agent-contracts.test.ts` | Focused unit tests used in the latest checks |
| `npx drizzle-kit check` | Check Drizzle migration metadata consistency; does not apply SQL or prove PostgreSQL execution |
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate` | Apply migrations to the configured database |

There is no dedicated `test` script in `package.json`. A Playwright suite exists, but the current `playwright.config.ts` points to the deployed production URL. Do not run it against production for integration or responsive checks. Configure an approved isolated staging target and test data before browser testing.

## Latest verification status

| Check | Result |
|---|---|
| TypeScript typecheck | Passed |
| Focused ESLint over Phase 4 and responsive files | Passed |
| Production build | Passed |
| Phase 3/4 focused unit tests | Passed: 6 tests |
| `drizzle-kit check` | Passed; migration metadata check only |
| PostgreSQL application of `0011_sales_sequences.sql` | Not verified — safe test database unavailable |
| Agent API integration and two-tenant tests | Not verified — approved test environment unavailable |
| Provider failure simulation | Not verified — no mocked provider/API integration tests executed |
| Mobile/tablet/desktop browser validation | Not verified — no approved staging/browser target; Playwright config targets production |
| Full authentication, CRM, analytics, AI, notification regression | Not verified end-to-end |

No production database operations or Playwright runs against production were performed during the latest hardening pass.

## Remaining release work

Before calling the platform release-verified:

1. Provision an isolated PostgreSQL database and two test organizations; apply migrations there, including `0011_sales_sequences.sql`, then verify schema and sequence API behavior.
2. Run API integration tests for all six agents and action routes: authentication, permissions, organization isolation, ownership, malformed input/output, provider failure, rate limits, action confirmation, and audit records.
3. Exercise representative cross-tenant attempts across CRM, analytics, AI, notifications, and agent endpoints using direct IDs and client-supplied organization IDs.
4. Run responsive Playwright checks at approximately 390×844, 768×1024, and 1440×900 against isolated staging. Current Playwright base URL must not be used for production testing or destructive flows.
5. Run the regression scenarios for auth, CRM CRUD, Phase 1–4 intelligence, and sequences in an approved test environment.
6. Decide whether production rate limiting requires a shared store. The current limiter is in-memory and counters are not shared across horizontally scaled instances.
7. Review database backup/restore, migration rollback/recovery, monitoring, AI provider data handling, and deployment secrets in the actual production environment.

These are verification and operational release tasks; they are not new product features.

## Deployment notes

The repository includes `vercel.json` configured for Next.js, `npm run build`, and the `bom1` region. Deployment still requires production values for server-only secrets and PostgreSQL, a controlled migration plan, and configured external providers only when those integrations are intended. The presence of deployment configuration is not proof that production data, migration status, credentials, or operational controls have been validated.

## Repository documentation note

The existing `README.md` and `docs/ARCHITECTURE.md` still contain historical Phase 1/roadmap wording. This `readme1.md` is the consolidated current-state and release-readiness summary; it does not rewrite those files.
