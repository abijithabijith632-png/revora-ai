/**
 * AI service layer entry point.
 *
 * Phase 1 exposes the contract + a registry placeholder. No algorithms and
 * no fake AI outputs are implemented yet. Real capabilities (scoring,
 * qualification, prediction, etc.) arrive in later phases and will implement
 * the interfaces defined in `./types`.
 */

export type {
  LeadScoringService,
  QualificationService,
  NextActionService,
  FollowUpService,
  ClientSummaryService,
  PredictionService,
  RiskService,
  AiServices,
} from "./types";
