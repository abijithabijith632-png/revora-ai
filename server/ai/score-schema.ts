import { z } from "zod";

/**
 * Centralized AI score definitions: levels, thresholds, and the strict Zod
 * schema for validating structured AI output. Never trust raw model output.
 */

export const SCORE_LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
export type ScoreLevel = (typeof SCORE_LEVELS)[number];

export interface ScoreBand {
  level: ScoreLevel;
  min: number;
  max: number;
  label: string;
}

/** Centralized 0–100 score interpretation. */
export const SCORE_BANDS: ScoreBand[] = [
  { level: "LOW", min: 0, max: 29, label: "Low" },
  { level: "MEDIUM", min: 30, max: 59, label: "Medium" },
  { level: "HIGH", min: 60, max: 79, label: "High" },
  { level: "VERY_HIGH", min: 80, max: 100, label: "Very High" },
];

export function scoreToLevel(score: number): ScoreLevel {
  const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
  return band?.level ?? "LOW";
}

export function scoreToLabel(score: number): string {
  return scoreToLevel(score).toLowerCase().replace("_", " ");
}

export const FACTOR_KEYS = [
  "budget_alignment",
  "requirement_clarity",
  "purchase_timeline",
  "decision_maker",
  "company_fit",
  "product_fit",
  "engagement_strength",
  "lead_source_quality",
  "historical_signal",
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];

/**
 * Models sometimes echo the untrusted CRM field names (companySize,
 * interestedProduct, ...) as `factor` keys instead of the canonical enum.
 * Map those observed variants to the closest canonical factor so strict
 * validation still holds. Unknown keys remain untouched and are rejected.
 */
const FACTOR_ALIASES: Record<string, FactorKey> = {
  budget_alignment: "budget_alignment",
  budget: "budget_alignment",
  budgetAvailability: "budget_alignment",
  budget_availability: "budget_alignment",
  requirement_clarity: "requirement_clarity",
  requirementClarity: "requirement_clarity",
  purchase_timeline: "purchase_timeline",
  purchaseTimeline: "purchase_timeline",
  expectedClosingDate: "purchase_timeline",
  expected_closing_date: "purchase_timeline",
  decision_maker: "decision_maker",
  decisionMaker: "decision_maker",
  company_fit: "company_fit",
  companyFit: "company_fit",
  companySize: "company_fit",
  company_size: "company_fit",
  industry: "company_fit",
  companyScale: "company_fit",
  geography: "company_fit",
  product_fit: "product_fit",
  productFit: "product_fit",
  interestedProduct: "product_fit",
  interested_product: "product_fit",
  engagement_strength: "engagement_strength",
  engagementStrength: "engagement_strength",
  engagement: "engagement_strength",
  activityCount: "engagement_strength",
  lastActivityAt: "engagement_strength",
  lead_source_quality: "lead_source_quality",
  leadSourceQuality: "lead_source_quality",
  source: "lead_source_quality",
  historical_signal: "historical_signal",
  historicalSignal: "historical_signal",
  conversionProbability: "historical_signal",
  outcome: "historical_signal",
};

export function normalizeFactorKeys(reasons: unknown[]): unknown[] {
  return reasons.map((reason) => {
    if (
      reason &&
      typeof reason === "object" &&
      "factor" in (reason as Record<string, unknown>)
    ) {
      const raw = (reason as Record<string, unknown>).factor as string;
      const canonical = FACTOR_ALIASES[raw];
      if (canonical && canonical !== raw) {
        return { ...(reason as object), factor: canonical };
      }
    }
    return reason;
  });
}

export const reasonSchema = z.object({
  factor: z.enum(FACTOR_KEYS),
  label: z.string().min(1).max(80),
  impact: z.enum(["positive", "neutral", "negative"]),
  explanation: z.string().min(1).max(500),
  evidence: z.string().max(200).optional(),
});

export const aiScoreResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(SCORE_LEVELS),
  confidence: z.number().min(0).max(1).optional(),
  dataQuality: z.number().int().min(0).max(100),
  reasons: z.array(reasonSchema).min(1).max(12),
  summary: z.string().min(1).max(1000),
  riskSignals: z.array(z.string().min(1).max(200)).max(6).default([]),
  positiveSignals: z.array(z.string().min(1).max(200)).max(8).default([]),
});

export type AiScoreResponse = z.infer<typeof aiScoreResponseSchema>;
