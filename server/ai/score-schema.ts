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
