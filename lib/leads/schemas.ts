import { z } from "zod";

/**
 * Lead validation schemas — single source of truth shared by route handlers
 * and client forms. Values mirror the PostgreSQL enums in db/schema/enums.ts
 * (lower_snake_case storage).
 */

export const LEAD_SOURCES = [
  "website",
  "google_search",
  "referral",
  "partner_referral",
  "social_media",
  "paid_advertisements",
  "cold_calls",
  "direct_email",
  "tradeshows_events",
  "existing_customers",
  "campaign",
  "partner",
  "manual",
  "import",
  "api",
  "others",
] as const;

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Convert an empty string to `undefined` so optional fields stay clean. */
function emptyToUndefined(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

/** Optional trimmed string of a max length. */
function optionalString(max = 255) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
}

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email("Enter a valid email address.").max(320).optional(),
);

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url("Enter a valid URL.").max(255).optional(),
);

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date.")
    .optional(),
);

const optionalBudget = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).max(2_147_483_647).optional(),
);

export const createLeadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(128),
  lastName: optionalString(128),
  email: optionalEmail,
  phone: optionalString(32),
  alternatePhone: optionalString(32),
  companyName: optionalString(255),
  industry: optionalString(128),
  companySize: optionalString(64),
  geography: optionalString(128),
  website: optionalUrl,
  // Custom values are permitted (Phase 16 tenant-configurable status/source);
  // service layer validates against system ∪ org-active config.
  source: z.string().trim().min(1).max(64).default("manual"),
  status: z.string().trim().min(1).max(64).default("new"),
  ownerId: z.string().uuid().nullish(),
  budget: optionalBudget,
  expectedClosingDate: optionalDate,
  interestedProduct: optionalString(255),
  notes: optionalString(10_000),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  // firstName may be cleared when empty on partial updates? Keep required if
  // provided, otherwise undefined (no-op).
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(128)
    .optional(),
});

export const updateLeadStatusSchema = z.object({
  status: z.string().trim().min(1).max(64),
  notes: optionalString(2_000),
  reason: z
    .enum([
      "no_budget",
      "poor_product_fit",
      "no_decision_maker",
      "no_active_requirement",
      "timeline_too_distant",
      "duplicate",
      "other",
    ])
    .optional(),
});

export const assignLeadSchema = z.object({
  ownerId: z.string().uuid().nullable(),
  strategy: z
    .enum(["manual", "round_robin", "territory", "skill"])
    .default("manual"),
  reason: optionalString(500),
});

export const autoAssignLeadSchema = z.object({
  strategy: z.enum(["round_robin", "territory", "skill"]),
  reason: optionalString(500),
});

export const mergeLeadsSchema = z.object({
  targetLeadId: z.string().uuid(),
});

export const leadFilterSchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  source: z.string().trim().min(1).max(64).optional(),
  ownerId: z.string().uuid().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type AutoAssignLeadInput = z.infer<typeof autoAssignLeadSchema>;
export type MergeLeadsInput = z.infer<typeof mergeLeadsSchema>;
export type LeadFilter = z.infer<typeof leadFilterSchema>;

/* -------------------------------------------------------------
 * Qualification (Phase 8)
 * ------------------------------------------------------------ */
export const QUALIFICATION_OUTCOME_VALUES = [
  "qualified",
  "partially_qualified",
  "unqualified",
] as const;

export const createQualificationSchema = z.object({
  requirementClarity: z.enum(["clear", "partially_clear", "unclear", "unknown"]),
  budgetAvailability: z.enum(["confirmed", "estimated", "not_confirmed", "unknown"]),
  purchaseTimeline: z.enum([
    "immediate",
    "0_30_days",
    "31_90_days",
    "3_6_months",
    "6_plus_months",
    "unknown",
  ]),
  decisionMaker: z.enum(["identified", "partially_identified", "not_identified", "unknown"]),
  companyScale: z.enum(["strong_fit", "moderate_fit", "weak_fit", "unknown"]),
  productFit: z.enum(["strong_fit", "partial_fit", "weak_fit", "unknown"]),
  conversionProbability: z.enum(["high", "medium", "low", "unknown"]),
  decisionMakerName: optionalString(255),
  decisionMakerDesignation: optionalString(128),
  outcome: z.enum(QUALIFICATION_OUTCOME_VALUES),
  reason: z
    .enum([
      "no_budget",
      "poor_product_fit",
      "no_decision_maker",
      "no_active_requirement",
      "timeline_too_distant",
      "duplicate",
      "other",
    ])
    .optional(),
  notes: optionalString(10_000),
  /** When true, also apply the outcome's permitted lifecycle transition. */
  applyTransition: z.boolean().default(false),
});

export type CreateQualificationInput = z.infer<typeof createQualificationSchema>;
