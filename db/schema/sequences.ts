import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { leads } from "./sales";
import { createdAt, updatedAt } from "./common";

export type SalesSequenceStep = {
  type: "email" | "wait" | "followup" | "activity" | "review";
  label: string;
  delayMinutes?: number;
  description?: string;
};

export const salesSequences = pgTable("sales_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  steps: jsonb("steps").$type<SalesSequenceStep[]>().notNull().default([]),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
}, (table) => [index("sales_sequences_org_status_idx").on(table.organizationId, table.status)]);

export const salesSequenceEnrollments = pgTable("sales_sequence_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  sequenceId: uuid("sequence_id").notNull().references(() => salesSequences.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  currentStep: integer("current_step").notNull().default(0),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("sales_sequence_enrollment_unique_idx").on(table.organizationId, table.sequenceId, table.leadId),
  index("sales_sequence_enrollment_due_idx").on(table.organizationId, table.status, table.nextRunAt),
]);

export const salesSequenceExecutions = pgTable("sales_sequence_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => salesSequenceEnrollments.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  result: varchar("result", { length: 32 }).notNull(),
  details: jsonb("details"),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("sales_sequence_execution_once_idx").on(table.organizationId, table.enrollmentId, table.stepIndex),
  index("sales_sequence_execution_org_time_idx").on(table.organizationId, table.executedAt),
]);
