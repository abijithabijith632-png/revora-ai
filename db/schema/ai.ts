import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { insightTypeEnum } from "./enums";
import { createdAt, updatedAt } from "./common";

/**
 * AI domain — persistent, explainable AI insights, user feedback, and
 * prediction history. Algorithms arrive in later phases; this stores results.
 */

/* -------------------------------------------------------------
 * AI insights (explainable — reasons/signals as JSONB)
 * ------------------------------------------------------------ */
export const aiInsights = pgTable(
  "ai_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    insightType: insightTypeEnum("insight_type").notNull(),
    result: varchar("result", { length: 255 }).notNull(),
    score: integer("score"),
    confidence: integer("confidence"),
    reasons: jsonb("reasons").$type<string[]>().default([]).notNull(),
    positiveSignals: jsonb("positive_signals").$type<string[]>().default([]).notNull(),
    riskSignals: jsonb("risk_signals").$type<string[]>().default([]).notNull(),
    recommendation: text("recommendation"),
    supportingData: jsonb("supporting_data"),
    modelVersion: varchar("model_version", { length: 64 }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("ai_insights_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
    ),
    index("ai_insights_type_idx").on(table.organizationId, table.insightType),
    index("ai_insights_created_idx").on(table.organizationId, table.createdAt),
  ],
);

/* -------------------------------------------------------------
 * AI recommendation feedback
 * ------------------------------------------------------------ */
export const aiInsightFeedback = pgTable(
  "ai_insight_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    insightId: uuid("insight_id")
      .notNull()
      .references(() => aiInsights.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    useful: boolean("useful").notNull(),
    reason: varchar("reason", { length: 128 }),
    feedbackText: text("feedback_text"),
    createdAt,
  },
  (table) => [
    index("ai_insight_feedback_insight_idx").on(table.organizationId, table.insightId),
  ],
);

/* -------------------------------------------------------------
 * AI prediction history (track changing predictions over time)
 * ------------------------------------------------------------ */
export const aiPredictionHistory = pgTable(
  "ai_prediction_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    insightType: insightTypeEnum("insight_type").notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    result: varchar("result", { length: 255 }).notNull(),
    score: integer("score"),
    confidence: integer("confidence"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_prediction_history_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
    ),
    index("ai_prediction_history_recorded_idx").on(
      table.organizationId,
      table.recordedAt,
    ),
  ],
);

export type AiInsight = typeof aiInsights.$inferSelect;
