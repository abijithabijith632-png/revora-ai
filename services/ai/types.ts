import type { ExplainableAiResult } from "@/types/ai";

/**
 * AI service abstraction contracts.
 *
 * These interfaces define the future AI layer WITHOUT implementing algorithms.
 * No fake outputs are produced — capabilities are registered here so later
 * phases can plug in real models while keeping the explainability contract.
 */

export interface LeadScoringService {
  scoreLead(input: unknown): Promise<ExplainableAiResult<string>>;
}

export interface QualificationService {
  qualifyLead(input: unknown): Promise<ExplainableAiResult<string>>;
}

export interface NextActionService {
  suggest(input: unknown): Promise<ExplainableAiResult<string>>;
}

export interface FollowUpService {
  generate(input: unknown): Promise<ExplainableAiResult<string>>;
}

export interface ClientSummaryService {
  summarize(input: unknown): Promise<ExplainableAiResult<string>>;
}

export interface PredictionService {
  predict(input: unknown): Promise<ExplainableAiResult<string>>;
}

export interface RiskService {
  assess(input: unknown): Promise<ExplainableAiResult<string>>;
}

/**
 * Aggregated AI service registry. Concrete implementations are wired in
 * later phases; this registry provides a single injection point.
 */
export interface AiServices {
  scoring: LeadScoringService;
  qualification: QualificationService;
  nextAction: NextActionService;
  followUp: FollowUpService;
  clientSummary: ClientSummaryService;
  prediction: PredictionService;
  risk: RiskService;
}
