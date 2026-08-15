/**
 * AI-related domain types (shared across services and clients).
 *
 * IMPORTANT: Explainability is a locked product requirement. Every important
 * AI result MUST eventually carry reasoning/signals so decisions are
 * auditable and explainable to users.
 */

/**
 * A generic, explainable AI result. All future AI capabilities
 * (lead scoring, qualification, prediction, risk, etc.) return this shape.
 */
export interface ExplainableAiResult<T = string> {
  /** The primary result/label. */
  result: T;
  /** Numeric score (0-100) when applicable. */
  score?: number;
  /** Confidence level (0-100). */
  confidence?: number;
  /** Human-readable reasons behind the result. */
  reasons: string[];
  /** Signals that support a positive outcome. */
  positiveSignals: string[];
  /** Signals that indicate risk or negative outcome. */
  riskSignals: string[];
  /** Arbitrary structured supporting data (e.g. contributing factors). */
  supportingData?: unknown;
  /** Recommended next action, when applicable. */
  recommendation?: string;
}

/**
 * Domain-specific capability result labels. Extend per-phase.
 */
export type LeadScoreLabel =
  | "High Probability"
  | "Medium Probability"
  | "Low Probability";

export type QualificationLabel = "Qualified" | "Needs Nurture" | "Disqualified";

export type RiskLabel = "Low Risk" | "Medium Risk" | "High Risk";
