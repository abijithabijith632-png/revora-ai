import { z } from "zod";

/**
 * Client + contact validation schemas. Shared by route handlers and client
 * forms. Values mirror PostgreSQL enums in db/schema/enums.ts.
 */

/** Convert an empty string to `undefined` so optional fields stay clean. */
function emptyToUndefined(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

function optionalString(max = 255) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
}

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url("Enter a valid URL.").max(255).optional(),
);

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email("Enter a valid email address.").max(320).optional(),
);

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date.")
    .optional(),
);

export const createClientSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(255),
  industry: optionalString(128),
  companySize: optionalString(64),
  corporateInfo: optionalString(10_000),
  address: optionalString(10_000),
  billingAddress: optionalString(10_000),
  website: optionalUrl,
  accountManagerId: z.string().uuid().nullish(),
  customerSince: optionalDate,
  status: z.enum(["active", "inactive", "churned", "vip"]).default("active"),
  vipFlag: z.boolean().default(false),
  notes: optionalString(10_000),
});

export const updateClientSchema = createClientSchema.partial();

export const clientStatusSchema = z.object({
  status: z.enum(["active", "inactive", "churned", "vip"]),
});

export const createContactSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required.").max(128),
  lastName: optionalString(128),
  designation: optionalString(128),
  email: optionalEmail,
  phone: optionalString(32),
  linkedinUrl: optionalUrl,
  preferredChannel: z.enum(["email", "phone", "whatsapp"]).optional(),
  isPrimary: z.boolean().default(false),
});

export const updateContactSchema = createContactSchema.partial().extend({
  // `clientId` is immutable on update (cross-tenant protection).
  clientId: z.string().uuid().optional(),
});

export const clientFilterSchema = z.object({
  status: z.enum(["active", "inactive", "churned", "vip"]).optional(),
  industry: z.string().optional(),
  accountManagerId: z.string().uuid().optional(),
});

export const contactFilterSchema = z.object({
  clientId: z.string().uuid().optional(),
  designation: z.string().optional(),
  preferredChannel: z.enum(["email", "phone", "whatsapp"]).optional(),
  isPrimary: z.enum(["true", "false"]).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientStatusInput = z.infer<typeof clientStatusSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ClientFilter = z.infer<typeof clientFilterSchema>;
export type ContactFilter = z.infer<typeof contactFilterSchema>;
