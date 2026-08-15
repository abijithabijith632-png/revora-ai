# Phase 9 — AI Lead Intelligence

## Objective

Add a real, explainable AI Lead Scoring engine (0–100) grounded in actual
CRM/qualification/engagement data, with an evidence-based reason matrix, score
history, and safe recalculation — reusing Phases 1–8.

## Provider (Groq, OpenAI-compatible)

- Endpoint: `https://api.groq.com/openai/v1` (OpenAI-compatible chat completions).
- Key: server-side only, stored in `.env` (gitignored), never hardcoded, never
  exposed to the client or returned in API responses.
- Structured output via `response_format: { type: "json_object" }` + server-side
  Zod validation (never trust raw model output).

## Key decisions (minimal, reuse-first)

- Reuse [`aiInsights`](db/schema/ai.ts:25) for score history + latest score
  (it already has score/confidence/reasons/positiveSignals/riskSignals/
  recommendation/supportingData/modelVersion). No new table.
- Reuse [`leads.aiScore` / `aiScoreCategory` / `aiScoreConfidence`](db/schema/sales.ts:56)
  as the latest-score snapshot (updated on each scoring run).
- Reuse [`services/ai/types.ts`](services/ai/types.ts:11) `LeadScoringService`
  contract; implement it against Groq.
- Reuse [`components/ai`](components/ai/index.ts:1) (`AiOrb`, `AiInsightCard`,
  `AiConfidence`, `AiProcessing`).
- Reuse Phase 5 RBAC, Phase 6 rate-limit/audit/API envelope.

## Architecture

```
Client → POST /api/leads/:id/ai-score → LeadScoringService
  → buildScoringContext(lead, qualification, engagement)  [server, tenant-scoped]
  → GroqProvider.generateStructured(...)
  → validateAiScoreResponse(zod)
  → persist aiInsights + update leads.aiScore*  [transaction]
  → recordAudit
  → return safe result
```

## Score levels (centralized)

0–29 Low, 30–59 Medium, 60–79 High, 80–100 Very High.

## Reason matrix factors (only when data exists)

Budget Alignment, Requirement Clarity, Purchase Timeline, Decision Maker,
Company Fit, Product/Service Fit, Engagement Strength, Lead Source/Quality.
Missing data → "Insufficient data", never fabricated.

## Data quality vs confidence

- Model confidence only if provider returns a legitimate estimate; otherwise
  compute `inputQuality` (fields available / relevant fields) and label it
  "Data Quality" — never present it as AI confidence.

## Human vs AI

Qualification outcome and AI score remain independent. AI never mutates
`qualificationStatus`.

## Files

New:
- [`server/ai/provider.ts`](server/ai/provider.ts) — OpenAI-compatible Groq client (server-only).
- [`server/ai/scoring-context.ts`](server/ai/scoring-context.ts) — input builder + prompt (SYSTEM vs UNTRUSTED DATA separation).
- [`server/ai/score-schema.ts`](server/ai/score-schema.ts) — Zod validation for AI response + score levels.
- [`server/services/lead-scoring.ts`](server/services/lead-scoring.ts) — scoring service.
- [`app/api/leads/[id]/ai-score/route.ts`](app/api/leads/[id]/ai-score/route.ts) — POST score + GET history.
- [`components/leads/ai-score-card.tsx`](components/leads/ai-score-card.tsx) — premium score ring + reason matrix + summary.
- [`db/ai-score-smoke.ts`](db/ai-score-smoke.ts) — tests.

Modified:
- [`config/env.ts`](config/env.ts) — AI provider config.
- [`.env.example`](.env.example) — AI env var names (no real key).
- [`.env`](.env) — real key (gitignored).
- [`components/leads/lead-table.tsx`](components/leads/lead-table.tsx) — AI score column + filter/sort.
- [`app/(app)/leads/[id]/page.tsx`](app/(app)/leads/[id]/page.tsx) — AI intelligence section.
- [`lib/leads/schemas.ts`](lib/leads/schemas.ts) / [`presentation.ts`](lib/leads/presentation.ts) — score filter + labels.

## Validation

Typecheck, lint, build, ai-score-smoke (validation/explainability/RBAC/tenant
isolation), regression (leads + qualification smoke).
