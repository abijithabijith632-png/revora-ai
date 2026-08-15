/**
 * Centralized Qualification Framework — seven Track A criteria and three
 * outcomes, with structured controlled values and contextual explanations.
 * No AI; values are manually assessed.
 */

export type QualificationOutcome =
  | "pending"
  | "qualified"
  | "partially_qualified"
  | "unqualified";

export const QUALIFICATION_OUTCOMES: QualificationOutcome[] = [
  "pending",
  "qualified",
  "partially_qualified",
  "unqualified",
];

export const OUTCOME_LABELS: Record<QualificationOutcome, string> = {
  pending: "Not Assessed",
  qualified: "Qualified",
  partially_qualified: "Partially Qualified",
  unqualified: "Unqualified",
};

export const OUTCOME_DESCRIPTIONS: Record<QualificationOutcome, string> = {
  pending: "Lead has not yet been qualified.",
  qualified: "Lead has met the sales-readiness criteria and is ready for the next commercial stage.",
  partially_qualified: "Lead has potential but requires nurturing before it is sales-ready.",
  unqualified: "Lead currently does not meet qualification requirements.",
};

export type RequirementClarity =
  | "clear"
  | "partially_clear"
  | "unclear"
  | "unknown";

export type BudgetAvailability =
  | "confirmed"
  | "estimated"
  | "not_confirmed"
  | "unknown";

export type PurchaseTimeline =
  | "immediate"
  | "0_30_days"
  | "31_90_days"
  | "3_6_months"
  | "6_plus_months"
  | "unknown";

export type DecisionMaker =
  | "identified"
  | "partially_identified"
  | "not_identified"
  | "unknown";

export type CompanyScale = "strong_fit" | "moderate_fit" | "weak_fit" | "unknown";

export type ProductFit = "strong_fit" | "partial_fit" | "weak_fit" | "unknown";

export type ConversionProbability = "high" | "medium" | "low" | "unknown";

export type DisqualificationReason =
  | "no_budget"
  | "poor_product_fit"
  | "no_decision_maker"
  | "no_active_requirement"
  | "timeline_too_distant"
  | "duplicate"
  | "other";

export interface CriterionDefinition {
  key: string;
  label: string;
  explanation: string;
  values: readonly string[];
  valueLabels: Record<string, string>;
}

export const QUALIFICATION_CRITERIA: CriterionDefinition[] = [
  {
    key: "requirementClarity",
    label: "Requirement Clarity",
    explanation: "Indicates how clearly the prospect has defined the business requirement.",
    values: ["clear", "partially_clear", "unclear", "unknown"] as const,
    valueLabels: {
      clear: "Clear",
      partially_clear: "Partially Clear",
      unclear: "Unclear",
      unknown: "Unknown",
    },
  },
  {
    key: "budgetAvailability",
    label: "Budget Availability",
    explanation: "Indicates whether sufficient budget has been confirmed or estimated.",
    values: ["confirmed", "estimated", "not_confirmed", "unknown"] as const,
    valueLabels: {
      confirmed: "Confirmed",
      estimated: "Estimated",
      not_confirmed: "Not Confirmed",
      unknown: "Unknown",
    },
  },
  {
    key: "purchaseTimeline",
    label: "Purchase Timeline",
    explanation: "Indicates when the prospect expects to make the purchase.",
    values: [
      "immediate",
      "0_30_days",
      "31_90_days",
      "3_6_months",
      "6_plus_months",
      "unknown",
    ] as const,
    valueLabels: {
      immediate: "Immediate",
      "0_30_days": "0–30 Days",
      "31_90_days": "31–90 Days",
      "3_6_months": "3–6 Months",
      "6_plus_months": "6+ Months",
      unknown: "Unknown",
    },
  },
  {
    key: "decisionMaker",
    label: "Decision Maker",
    explanation: "Indicates whether the person responsible for the buying decision has been identified.",
    values: ["identified", "partially_identified", "not_identified", "unknown"] as const,
    valueLabels: {
      identified: "Identified",
      partially_identified: "Partially Identified",
      not_identified: "Not Identified",
      unknown: "Unknown",
    },
  },
  {
    key: "companyScale",
    label: "Company Scale",
    explanation: "Evaluates whether the company size fits the organization's target profile.",
    values: ["strong_fit", "moderate_fit", "weak_fit", "unknown"] as const,
    valueLabels: {
      strong_fit: "Strong Fit",
      moderate_fit: "Moderate Fit",
      weak_fit: "Weak Fit",
      unknown: "Unknown",
    },
  },
  {
    key: "productFit",
    label: "Product/Service Fit",
    explanation: "Indicates how closely the requested solution matches your offering.",
    values: ["strong_fit", "partial_fit", "weak_fit", "unknown"] as const,
    valueLabels: {
      strong_fit: "Strong Fit",
      partial_fit: "Partial Fit",
      weak_fit: "Weak Fit",
      unknown: "Unknown",
    },
  },
  {
    key: "conversionProbability",
    label: "Conversion Probability",
    explanation: "Manual sales assessment of the likelihood of conversion (not an AI prediction).",
    values: ["high", "medium", "low", "unknown"] as const,
    valueLabels: {
      high: "High",
      medium: "Medium",
      low: "Low",
      unknown: "Unknown",
    },
  },
];

export const DISQUALIFICATION_REASONS: DisqualificationReason[] = [
  "no_budget",
  "poor_product_fit",
  "no_decision_maker",
  "no_active_requirement",
  "timeline_too_distant",
  "duplicate",
  "other",
];

export const DISQUALIFICATION_REASON_LABELS: Record<DisqualificationReason, string> = {
  no_budget: "No budget",
  poor_product_fit: "Poor product fit",
  no_decision_maker: "No decision maker",
  no_active_requirement: "No active requirement",
  timeline_too_distant: "Timeline too distant",
  duplicate: "Duplicate",
  other: "Other",
};
