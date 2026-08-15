# Phase 15 — Analytics, Reports, AI Forecasting/Risk & Global Search

## Status: COMPLETE ✅

Validated end-to-end: smoke tests 20/20, lint 0 warnings/errors, full regression
(leads → phase15) green, production build 67 pages / 63 API routes.

---

## 1. Global Search

- [`server/repositories/search.ts`](server/repositories/search.ts:1) — tenant-scoped,
  `ILIKE`-based aggregation across **leads, clients, contacts, opportunities,
  tasks, meetings, activities, documents**.
- [`server/services/search.ts`](server/services/search.ts:1) — applies the search
  permission gate (`global_search.view`) and normalizes results with a deep-link
  `href` per entity.
- API: [`app/api/search/route.ts`](app/api/search/route.ts:1) — `GET /api/search?q=…`.
- Cross-tenant isolation verified (other org returns zero results).

## 2. Analytics

- [`server/repositories/analytics.ts`](server/repositories/analytics.ts:1) — real
  PostgreSQL aggregations, no fabricated metrics:
  - `dashboard()` — total/new/qualified leads, active/won/lost opportunities,
    pipeline value, weighted pipeline value, won revenue, conversion rate.
  - `leadsOverTime(days)` — daily lead-count series (`to_char(date)`).
  - `funnel()` — lead → contacted → qualified → proposal → negotiation → won.
  - `sourceAttribution()` — lead counts grouped by source.
  - `pipelineByStage()` — count + value per pipeline stage.
  - `salespersonPerformance(ownerId?)` — won/lost ratio, revenue, avg deal size,
    task + follow-up SLA compliance.
- [`server/services/analytics.ts`](server/services/analytics.ts:1) — permission-gated
  orchestrator (`analytics.view`).
- API routes:
  - [`app/api/analytics/dashboard/route.ts`](app/api/analytics/dashboard/route.ts:1)
  - [`app/api/analytics/performance/route.ts`](app/api/analytics/performance/route.ts:1)
- Page: [`app/(app)/analytics/page.tsx`](app/(app)/analytics/page.tsx:1) — live
  dashboard (KPI cards, funnel, source attribution, pipeline-by-stage) with
  correctly typed `KpiCard` (`title`/`value` strings).

## 3. AI Forecasting, Deal Prediction & Risk

- [`server/services/forecasting.ts`](server/services/forecasting.ts:1) — explainable
  AI with honest degradation:
  - `revenueForecast()` — confirmed won revenue + probability-weighted open
    pipeline, reported per month with `method`, `providerConfigured`,
    `explanation`, and `currency`.
  - `dealPrediction(opportunityId)` — win probability mirroring the stage
    probability; persists to `aiPredictionHistory` + `aiInsights` (reasons,
    signals, recommendation, model version, confidence).
  - `churnRisk()` — real interaction-based risk (30+ days without a logged
    activity → Medium/High/Critical), marking unavailable signals
    (`support_tickets`, `product_usage`) explicitly.
- API routes:
  - [`app/api/analytics/forecast/route.ts`](app/api/analytics/forecast/route.ts:1)
  - [`app/api/analytics/deal-prediction/route.ts`](app/api/analytics/deal-prediction/route.ts:1)
  - [`app/api/analytics/risk/route.ts`](app/api/analytics/risk/route.ts:1)

## 4. Reports / Export

- [`server/services/reporting.ts`](server/services/reporting.ts:1) — self-contained,
  generic report builder (CSV, XLSX via `exceljs`, PDF via `pdfkit`) driven by a
  report registry (sales / leads / opportunities), separate from the lead-specific
  exporter.
- [`server/repositories/analytics.ts`](server/repositories/analytics.ts:1) supplies
  the underlying datasets.
- API: [`app/api/reports/route.ts`](app/api/reports/route.ts:1) — `GET /api/reports?type=…&format=csv|xlsx|pdf`.

## 5. Security & Least Privilege

- `analytics.view` — Super Admin / Admin / Sales Manager.
- `reports.export` — Super Admin / Admin only (Sales Executive denied, verified).
- `global_search.view` — gated search access.
- All aggregations scoped by `organization_id` server-side.

---

## Validation

| Check | Result |
|-------|--------|
| `npx tsx db/phase15-smoke.ts` | 20/20 passed |
| `npm run lint` | 0 warnings, 0 errors |
| Full regression (leads → phase15) | all green |
| `npm run build` | 67 pages, 63 API routes |

## Notes

- AI forecasting is **deterministic-first**: when `AI_PROVIDER_API_KEY` is absent
  the service returns an explicitly-labelled `deterministic_weighted_pipeline`
  result instead of fabricating a model response.
- Churn risk relies on real logged-activity data only; unavailable external
  signals are transparently enumerated rather than guessed.
