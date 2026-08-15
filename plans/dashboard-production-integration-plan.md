# Production Dashboard Integration Plan

## Problem
`/dashboard` still renders the Phase 2 design-system showcase with hardcoded
demo metrics (1,284 leads / 48 opportunities / ₹42.8L / 23.6% / AI score 94/100)
and placeholder messaging. The real Phase 15 analytics/dashboard already exists
at `/analytics` and via `/api/analytics/*`, but `/dashboard` is not wired to it.

## Solution (extend existing, no rebuild / no duplicate)
Replace the static showcase in `app/(app)/dashboard/page.tsx` with an async
server component that:

1. `requireSession()` then enforce `dashboard.view` via `userHasPermission`
   (redirect `/forbidden` on denial) — RBAC + tenant scope come from the session.
2. Reuse `AnalyticsService` (real PostgreSQL aggregations) for KPIs:
   total leads, new leads, qualified leads, active opportunities, pipeline value,
   won deals, lost deals, won revenue, conversion rate.
3. Reuse `ForecastingService` for the revenue forecast + churn risk (explainable,
   deterministic fallback when AI provider is unconfigured).
4. Pull the latest tenant-scoped `aiInsights` row to render a REAL explainable
   AI insight via the existing `AiInsightCard` (result/score/confidence/reasons/
   positive+risk signals/recommendation). If none exist, render an honest
   `EmptyState` (no fabricated AI values).
5. Keep the premium UI language: `KpiCard`, `Card`, `Badge`, `AiInsightCard`,
   light/dark theme, no placeholder/design-system messaging.
6. Compute win rate from real won/(won+lost) — never hardcode.

## Files touched
- `app/(app)/dashboard/page.tsx` (rewrite only)

## Validation
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Manual: sign in → `/dashboard` shows real DB values, tenant isolation, RBAC
  (all roles have `dashboard.view`), real AI insight or honest empty state.

## Out of scope
- No changes to `AnalyticsService`, `ForecastingService`, repositories, or the
  `/analytics` page.
