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
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { clients } from "./sales";
import { createdAt, updatedAt, deletedAt } from "./common";

/**
 * Opportunities / pipeline — opportunities, tenant-configurable pipeline
 * stages, and stage history.
 */

/* -------------------------------------------------------------
 * Pipeline stages (tenant-configurable)
 * ------------------------------------------------------------ */
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 64 }).notNull(),
    // Canonical stage slug for centralized business logic.
    key: varchar("key", { length: 32 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    probability: integer("probability"),
    isActive: boolean("is_active").default(true).notNull(),
    isTerminal: boolean("is_terminal").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("pipeline_stages_org_name_idx").on(table.organizationId, table.name),
    uniqueIndex("pipeline_stages_org_key_idx").on(table.organizationId, table.key),
    index("pipeline_stages_org_order_idx").on(table.organizationId, table.orderIndex),
  ],
);

/* -------------------------------------------------------------
 * Opportunities (deals)
 * ------------------------------------------------------------ */
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").references(() => pipelineStages.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    // Human-readable opportunity identifier (OPP-XXX).
    opportunityNumber: varchar("opportunity_number", { length: 32 }).notNull(),
    description: text("description"),
    amount: integer("amount"),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    probability: integer("probability"),
    source: varchar("source", { length: 64 }),
    productService: varchar("product_service", { length: 255 }),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    notes: text("notes"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("opportunities_org_number_idx").on(
      table.organizationId,
      table.opportunityNumber,
    ),
    index("opportunities_client_idx").on(table.organizationId, table.clientId),
    index("opportunities_owner_idx").on(table.organizationId, table.ownerId),
    index("opportunities_stage_idx").on(table.organizationId, table.stageId),
    index("opportunities_created_idx").on(table.organizationId, table.createdAt),
    index("opportunities_expected_close_idx").on(
      table.organizationId,
      table.expectedCloseDate,
    ),
  ],
);

/* -------------------------------------------------------------
 * Opportunity stage history
 * ------------------------------------------------------------ */
export const opportunityStageHistory = pgTable(
  "opportunity_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    previousStageId: uuid("previous_stage_id").references(() => pipelineStages.id, {
      onDelete: "set null",
    }),
    newStageId: uuid("new_stage_id").references(() => pipelineStages.id, {
      onDelete: "set null",
    }),
    previousProbability: integer("previous_probability"),
    newProbability: integer("new_probability"),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    reason: text("reason"),
  },
  (table) => [
    index("opportunity_stage_history_opp_idx").on(
      table.organizationId,
      table.opportunityId,
    ),
    index("opportunity_stage_history_changed_idx").on(
      table.organizationId,
      table.changedAt,
    ),
  ],
);

export type Opportunity = typeof opportunities.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
