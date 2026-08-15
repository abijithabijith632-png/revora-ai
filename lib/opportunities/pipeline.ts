import type { BadgeProps } from "@/components/ui/badge";

/**
 * Centralized Pipeline configuration — single source of truth for stage keys,
 * labels, order, default probabilities, terminal flags, and controlled
 * transitions. No scattered stage strings in UI components.
 */

export type PipelineStageKey =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "final_review"
  | "won"
  | "lost";

export interface StageDefinition {
  key: PipelineStageKey;
  label: string;
  order: number;
  probability: number;
  terminal: boolean;
  variant: NonNullable<BadgeProps["variant"]>;
}

export const PIPELINE_STAGES: StageDefinition[] = [
  { key: "new", label: "New", order: 1, probability: 10, terminal: false, variant: "info" },
  { key: "qualified", label: "Qualified", order: 2, probability: 30, terminal: false, variant: "warning" },
  { key: "proposal", label: "Proposal", order: 3, probability: 60, terminal: false, variant: "warning" },
  { key: "negotiation", label: "Negotiation", order: 4, probability: 80, terminal: false, variant: "warning" },
  { key: "final_review", label: "Final Review", order: 5, probability: 90, terminal: false, variant: "warning" },
  { key: "won", label: "Won / Closed", order: 6, probability: 100, terminal: true, variant: "success" },
  { key: "lost", label: "Lost", order: 7, probability: 0, terminal: true, variant: "danger" },
];

export const STAGE_BY_KEY = new Map(
  PIPELINE_STAGES.map((s) => [s.key, s]),
);

/** Ordered transitions: forward path + lost from any non-terminal stage. */
export const ALLOWED_TRANSITIONS: Record<PipelineStageKey, PipelineStageKey[]> = {
  new: ["qualified", "lost"],
  qualified: ["proposal", "lost"],
  proposal: ["negotiation", "lost"],
  negotiation: ["final_review", "won", "lost"],
  final_review: ["won", "lost"],
  won: [],
  lost: [],
};

export function canTransition(from: PipelineStageKey, to: PipelineStageKey): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedNextStages(current: PipelineStageKey): PipelineStageKey[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function stageLabel(key: string): string {
  return STAGE_BY_KEY.get(key as PipelineStageKey)?.label ?? key;
}

export function stageVariant(key: string): NonNullable<BadgeProps["variant"]> {
  return STAGE_BY_KEY.get(key as PipelineStageKey)?.variant ?? "neutral";
}

export function stageProbability(key: string): number {
  return STAGE_BY_KEY.get(key as PipelineStageKey)?.probability ?? 0;
}

export const LOSS_REASONS = [
  "price",
  "competitor",
  "timing",
  "no_budget",
  "poor_fit",
  "no_decision",
  "other",
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  price: "Price",
  competitor: "Competitor",
  timing: "Timing",
  no_budget: "No Budget",
  poor_fit: "Poor Fit",
  no_decision: "No Decision",
  other: "Other",
};

export const OPPORTUNITY_SOURCES = [
  "website",
  "referral",
  "existing_customer",
  "partner",
  "cold_call",
  "event",
  "campaign",
  "other",
] as const;

export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];

export const OPPORTUNITY_SOURCE_LABELS: Record<OpportunitySource, string> = {
  website: "Website",
  referral: "Referral",
  existing_customer: "Existing Customer",
  partner: "Partner",
  cold_call: "Cold Call",
  event: "Event",
  campaign: "Campaign",
  other: "Other",
};
