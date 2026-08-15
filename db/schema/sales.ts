import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import {
  leadQualificationStatusEnum,
  requirementClarityEnum,
  budgetAvailabilityEnum,
  purchaseTimelineEnum,
  decisionMakerEnum,
  companyScaleEnum,
  productFitEnum,
  conversionProbabilityEnum,
  disqualificationReasonEnum,
  clientStatusEnum,
} from "./enums";
import { createdAt, updatedAt, deletedAt } from "./common";

/**
 * Sales domain — leads, lead qualifications, lead assignment history,
 * clients, and contacts.
 */

/* -------------------------------------------------------------
 * Leads
 * ------------------------------------------------------------ */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    leadNumber: varchar("lead_number", { length: 32 }).notNull(),
    // Canonical structured identity (Phase 7+). `full_name` is kept in sync
    // for backward compatibility and is derived by the service layer.
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    alternatePhone: varchar("alternate_phone", { length: 32 }),
    companyName: varchar("company_name", { length: 255 }),
    industry: varchar("industry", { length: 128 }),
    companySize: varchar("company_size", { length: 64 }),
    geography: varchar("geography", { length: 128 }),
    website: varchar("website", { length: 255 }),
    source: varchar("source", { length: 64 }).default("manual").notNull(),
    status: varchar("status", { length: 64 }).default("new").notNull(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    mergedIntoId: uuid("merged_into_id").references(
      (): AnyPgColumn => leads.id,
      { onDelete: "set null" },
    ),
    budget: integer("budget"),
    expectedClosingDate: timestamp("expected_closing_date", { withTimezone: true }),
    interestedProduct: varchar("interested_product", { length: 255 }),
    notes: text("notes"),
    // AI-ready fields (populated in later phases)
    aiScore: integer("ai_score"),
    aiScoreCategory: varchar("ai_score_category", { length: 32 }),
    aiScoreConfidence: integer("ai_score_confidence"),
    qualificationStatus: leadQualificationStatusEnum("qualification_status")
      .default("pending")
      .notNull(),
    qualificationMetadata: jsonb("qualification_metadata"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("leads_org_number_idx").on(table.organizationId, table.leadNumber),
    index("leads_org_email_idx").on(table.organizationId, table.email),
    index("leads_org_phone_idx").on(table.organizationId, table.phone),
    index("leads_org_status_idx").on(table.organizationId, table.status),
    index("leads_org_owner_idx").on(table.organizationId, table.ownerId),
    index("leads_org_created_idx").on(table.organizationId, table.createdAt),
    index("leads_company_idx").on(table.organizationId, table.companyName),
  ],
);

/* -------------------------------------------------------------
 * Lead status history
 * ------------------------------------------------------------ */
export const leadStatusHistory = pgTable(
  "lead_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 64 }),
    toStatus: varchar("to_status", { length: 64 }).notNull(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text("notes"),
    reason: disqualificationReasonEnum("reason"),
  },
  (table) => [
    index("lead_status_history_lead_idx").on(table.organizationId, table.leadId),
    index("lead_status_history_changed_idx").on(
      table.organizationId,
      table.changedAt,
    ),
  ],
);

/* -------------------------------------------------------------
 * Lead qualifications
 * ------------------------------------------------------------ */
export const leadQualifications = pgTable(
  "lead_qualifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    // Seven structured qualification criteria (Phase 8).
    requirementClarity: requirementClarityEnum("requirement_clarity").notNull(),
    budgetAvailability: budgetAvailabilityEnum("budget_availability").notNull(),
    purchaseTimeline: purchaseTimelineEnum("purchase_timeline").notNull(),
    decisionMaker: decisionMakerEnum("decision_maker").notNull(),
    companyScale: companyScaleEnum("company_scale").notNull(),
    productFit: productFitEnum("product_fit").notNull(),
    conversionProbability: conversionProbabilityEnum("conversion_probability").notNull(),
    decisionMakerName: varchar("decision_maker_name", { length: 255 }),
    decisionMakerDesignation: varchar("decision_maker_designation", { length: 128 }),
    result: leadQualificationStatusEnum("result").notNull(),
    reason: disqualificationReasonEnum("reason"),
    notes: text("notes"),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }).defaultNow().notNull(),
    qualifiedBy: uuid("qualified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("lead_qualifications_lead_idx").on(table.organizationId, table.leadId),
    index("lead_qualifications_result_idx").on(table.organizationId, table.result),
  ],
);

/* -------------------------------------------------------------
 * Lead assignment history
 * ------------------------------------------------------------ */
export const leadAssignments = pgTable(
  "lead_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    previousOwnerId: uuid("previous_owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    strategy: varchar("strategy", { length: 32 }), // manual | round_robin | territory | skill
    reason: text("reason"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("lead_assignments_lead_idx").on(table.organizationId, table.leadId),
    index("lead_assignments_assignee_idx").on(table.organizationId, table.assignedTo),
  ],
);

/* -------------------------------------------------------------
 * Clients (accounts)
 * ------------------------------------------------------------ */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    sourceLeadId: uuid("source_lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    // Human-readable identifier (CL-XXXX) alongside the internal UUID.
    clientNumber: varchar("client_number", { length: 32 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 128 }),
    companySize: varchar("company_size", { length: 64 }),
    corporateInfo: text("corporate_info"),
    address: text("address"),
    billingAddress: text("billing_address"),
    website: varchar("website", { length: 255 }),
    primaryContactId: uuid("primary_contact_id"),
    accountManagerId: uuid("account_manager_id").references(() => users.id, {
      onDelete: "set null",
    }),
    customerSince: timestamp("customer_since", { withTimezone: true }),
    status: clientStatusEnum("status").default("active").notNull(),
    vipFlag: boolean("vip_flag").default(false).notNull(),
    notes: text("notes"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("clients_org_number_idx").on(
      table.organizationId,
      table.clientNumber,
    ),
    // Concurrency guard: a lead converts to at most one client per tenant.
    uniqueIndex("clients_org_source_lead_idx")
      .on(table.organizationId, table.sourceLeadId)
      .where(sql`${table.sourceLeadId} IS NOT NULL`),
    index("clients_org_status_idx").on(table.organizationId, table.status),
    index("clients_org_created_idx").on(table.organizationId, table.createdAt),
    index("clients_org_manager_idx").on(table.organizationId, table.accountManagerId),
    index("clients_company_idx").on(table.organizationId, table.companyName),
    index("clients_customer_since_idx").on(
      table.organizationId,
      table.customerSince,
    ),
  ],
);

/* -------------------------------------------------------------
 * Contacts (many per client)
 * ------------------------------------------------------------ */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 128 }).notNull(),
    lastName: varchar("last_name", { length: 128 }),
    designation: varchar("designation", { length: 128 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    linkedinUrl: varchar("linkedin_url", { length: 255 }),
    preferredChannel: varchar("preferred_channel", { length: 32 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("contacts_client_idx").on(table.organizationId, table.clientId),
    index("contacts_org_email_idx").on(table.organizationId, table.email),
    index("contacts_org_phone_idx").on(table.organizationId, table.phone),
    index("contacts_name_idx").on(
      table.organizationId,
      table.firstName,
      table.lastName,
    ),
    // At most one primary contact per client (only for primary rows).
    uniqueIndex("contacts_org_client_primary_idx")
      .on(table.organizationId, table.clientId)
      .where(sql`${table.isPrimary} = true`),
  ],
);

/* -------------------------------------------------------------
 * Lead status configuration (Phase 16 — tenant-configurable)
 * ------------------------------------------------------------ */
export const leadStatusConfigs = pgTable(
  "lead_status_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Canonical key, unique per tenant (e.g. "new", "qualified", "custom_x").
    key: varchar("key", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    color: varchar("color", { length: 32 }),
    orderIndex: integer("order_index").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("lead_status_configs_org_key_idx").on(table.organizationId, table.key),
    index("lead_status_configs_org_order_idx").on(table.organizationId, table.orderIndex),
  ],
);

/* -------------------------------------------------------------
 * Lead source configuration (Phase 16 — tenant-configurable)
 * ------------------------------------------------------------ */
export const leadSourceConfigs = pgTable(
  "lead_source_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("lead_source_configs_org_key_idx").on(table.organizationId, table.key),
    index("lead_source_configs_org_order_idx").on(table.organizationId, table.orderIndex),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatusHistory = typeof leadStatusHistory.$inferSelect;
export type LeadQualification = typeof leadQualifications.$inferSelect;
export type NewLeadQualification = typeof leadQualifications.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type LeadStatusConfig = typeof leadStatusConfigs.$inferSelect;
export type LeadSourceConfig = typeof leadSourceConfigs.$inferSelect;
