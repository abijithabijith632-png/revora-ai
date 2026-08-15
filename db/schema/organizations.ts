import { pgTable, uuid, varchar, text, boolean } from "drizzle-orm/pg-core";
import { organizationStatusEnum } from "./enums";
import { createdAt, updatedAt, deletedAt } from "./common";

/**
 * Organizations — the tenant root for the multi-tenant SaaS platform.
 * Every tenant-owned entity references `organizations.id` via `organization_id`.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  status: organizationStatusEnum("status").default("active").notNull(),
  logoUrl: text("logo_url"),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  currency: varchar("currency", { length: 3 }).default("INR").notNull(),
  // Company profile (Phase 16)
  description: text("description"),
  website: varchar("website", { length: 255 }),
  industry: varchar("industry", { length: 128 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 32 }),
  address: text("address"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  createdAt,
  updatedAt,
  deletedAt,
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
