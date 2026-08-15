import { z } from "zod";
import { OPPORTUNITY_SOURCES } from "./pipeline";

/**
 * Opportunity validation schemas. Shared by route handlers and client forms.
 */

function emptyToUndefined(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

function optionalString(max = 255) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
}

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date.")
    .optional(),
);

const optionalAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).max(2_147_483_647).optional(),
);

const optionalProbability = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).max(100).optional(),
);

export const STAGE_KEYS = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "final_review",
  "won",
  "lost",
] as const;

export const createOpportunitySchema = z.object({
  name: z.string().trim().min(1, "Opportunity name is required.").max(255),
  clientId: z.string().uuid(),
  ownerId: z.string().uuid().nullish(),
  amount: optionalAmount,
  probability: optionalProbability,
  expectedCloseDate: optionalDate,
  stageKey: z.enum(STAGE_KEYS).default("new"),
  source: z.enum(OPPORTUNITY_SOURCES).optional(),
  productService: optionalString(255),
  description: optionalString(10_000),
  notes: optionalString(10_000),
});

export const updateOpportunitySchema = createOpportunitySchema
  .partial()
  .extend({
    clientId: z.string().uuid().optional(),
  });

export const opportunityStageSchema = z.object({
  stageKey: z.enum(STAGE_KEYS),
  probability: optionalProbability,
  reason: optionalString(2000),
  notes: optionalString(2000),
});

export const opportunityFilterSchema = z.object({
  stageKey: z.enum(STAGE_KEYS).optional(),
  clientId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type OpportunityStageInput = z.infer<typeof opportunityStageSchema>;
export type OpportunityFilter = z.infer<typeof opportunityFilterSchema>;
