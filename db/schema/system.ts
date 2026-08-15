import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { roles } from "./rbac";
import {
  auditActionEnum,
  subscriptionStatusEnum,
  invitationStatusEnum,
  invoiceStatusEnum,
  paymentStatusEnum,
} from "./enums";
import { createdAt, updatedAt } from "./common";

/**
 * System domain — SaaS plans/subscriptions, organization settings, and
 * audit logs. SaaS is domain-foundation only (no payment processing).
 */

/* -------------------------------------------------------------
 * SaaS plans + subscriptions
 * ------------------------------------------------------------ */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  priceMonthly: integer("price_monthly"),
  limits: jsonb("limits"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt,
  updatedAt,
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    status: subscriptionStatusEnum("status").default("trial").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("subscriptions_org_idx").on(table.organizationId),
    index("subscriptions_status_idx").on(table.status),
  ],
);

/* -------------------------------------------------------------
 * Organization settings (1:1 with organization)
 * ------------------------------------------------------------ */
export const organizationSettings = pgTable("organization_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  currency: varchar("currency", { length: 3 }).default("INR").notNull(),
  dateFormat: varchar("date_format", { length: 32 }).default("MMM d, yyyy").notNull(),
  defaultPipelineId: uuid("default_pipeline_id"),
  notificationPreferences: jsonb("notification_preferences"),
  brandingPreferences: jsonb("branding_preferences"),
  aiPreferences: jsonb("ai_preferences"),
  integrationPreferences: jsonb("integration_preferences"),
  createdAt,
  updatedAt,
});

/* -------------------------------------------------------------
 * Audit logs
 * ------------------------------------------------------------ */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    metadata: jsonb("metadata"),
    createdAt,
  },
  (table) => [
    index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
    ),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;

/* -------------------------------------------------------------
 * User invitations (Phase 16 — secure token, tenant-scoped)
 * ------------------------------------------------------------ */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("invitations_org_email_idx").on(table.organizationId, table.email),
    index("invitations_token_hash_idx").on(table.tokenHash),
    index("invitations_status_idx").on(table.organizationId, table.status),
  ],
);

/* -------------------------------------------------------------
 * Invoices (Phase 16 — billing records; no card data)
 * ------------------------------------------------------------ */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    invoiceNumber: varchar("invoice_number", { length: 32 }).notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    status: invoiceStatusEnum("status").default("issued").notNull(),
    description: text("description"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("invoices_org_number_idx").on(table.organizationId, table.invoiceNumber),
    index("invoices_org_idx").on(table.organizationId),
  ],
);

/* -------------------------------------------------------------
 * Payments (Phase 16 — provider references only, never card data)
 * ------------------------------------------------------------ */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerReference: varchar("provider_reference", { length: 255 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("payments_org_idx").on(table.organizationId),
    index("payments_invoice_idx").on(table.invoiceId),
  ],
);

export type Invitation = typeof invitations.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
