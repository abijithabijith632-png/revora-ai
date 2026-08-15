import { z } from "zod";
import { EMAIL_TEMPLATE_CATEGORIES } from "./presentation";

/**
 * Commercial/communication validation schemas (Phase 14) — shared by route
 * handlers and client forms. Values mirror PostgreSQL enums/types.
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

const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid().nullish());

const optionalAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).max(2_147_483_647).optional(),
);

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const;

export const createProposalSchema = z.object({
  opportunityId: z.string().uuid(),
  clientId: optionalUuid,
  ownerId: optionalUuid,
  title: z.string().trim().min(1, "Proposal title is required.").max(255),
  amount: optionalAmount,
  status: z.enum(PROPOSAL_STATUSES).default("draft"),
  expiryDate: optionalDate,
  notes: optionalString(10_000),
});

export const updateProposalSchema = createProposalSchema.partial().extend({
  opportunityId: z.string().uuid().optional(),
});

export const proposalStatusSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
  notes: optionalString(2_000),
});

export const proposalFilterSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  opportunityId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});

export const createEmailTemplateSchema = z.object({
  category: z.enum(EMAIL_TEMPLATE_CATEGORIES),
  name: z.string().trim().min(1, "Template name is required.").max(255),
  subject: z.string().trim().min(1, "Subject is required.").max(255),
  body: z.string().trim().min(1, "Body is required."),
  variables: z.record(z.string()).optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

export const emailTemplateFilterSchema = z.object({
  category: z.enum(EMAIL_TEMPLATE_CATEGORIES).optional(),
  archived: z.enum(["true", "false"]).optional(),
});

export const createDocumentSchema = z.object({
  name: z.string().trim().min(1, "Document name is required.").max(255),
  documentType: z
    .enum(["proposal", "contract", "invoice", "presentation", "nda", "other"])
    .default("other"),
  fileReference: optionalString(512),
  sizeBytes: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).optional(),
  ),
  mimeType: optionalString(128),
  clientId: optionalUuid,
  opportunityId: optionalUuid,
  leadId: optionalUuid,
  version: z.number().int().min(1).default(1),
  status: z.string().max(32).default("active"),
  accessPermissions: z.record(z.unknown()).optional(),
});

export const updateDocumentSchema = createDocumentSchema.partial();

export const documentFilterSchema = z.object({
  documentType: z
    .enum(["proposal", "contract", "invoice", "presentation", "nda", "other"])
    .optional(),
  clientId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  status: z.string().max(32).optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type ProposalStatusInput = z.infer<typeof proposalStatusSchema>;
export type ProposalFilter = z.infer<typeof proposalFilterSchema>;

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
export type EmailTemplateFilter = z.infer<typeof emailTemplateFilterSchema>;

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentFilter = z.infer<typeof documentFilterSchema>;
