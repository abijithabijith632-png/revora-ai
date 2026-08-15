import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { userStatusEnum } from "./enums";
import { createdAt, updatedAt, deletedAt } from "./common";

/**
 * Users — members of an organization (tenant-owned).
 *
 * RBAC is modeled relationally via `user_roles` (see ./rbac.ts) rather than a
 * single `role` string column. Authentication itself arrives in Phase 4.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    jobTitle: varchar("job_title", { length: 128 }),
    // Phase 16: department + designation (user administration).
    department: varchar("department", { length: 128 }),
    designation: varchar("designation", { length: 128 }),
    avatarUrl: text("avatar_url"),
    // Platform-level admin (Phase 16) — separate from org RBAC. NEVER granted
    // through org user-admin UI; only set via direct DB/platform seed.
    isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
    status: userStatusEnum("status").default("active").notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    // Global unique email is required for unambiguous email+password login.
    uniqueIndex("users_email_idx").on(table.email),
    index("users_org_idx").on(table.organizationId),
    index("users_status_idx").on(table.organizationId, table.status),
    index("users_created_at_idx").on(table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * User skills — tenant-owned capability declarations used by skill-based
 * routing. `skillType` mirrors the supported routing dimensions:
 * product | language | enterprise_level.
 */
export const userSkills = pgTable(
  "user_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skill: varchar("skill", { length: 128 }).notNull(),
    skillType: varchar("skill_type", { length: 32 }).notNull(),
    proficiency: varchar("proficiency", { length: 32 }).notNull(),
  },
  (table) => [
    index("user_skills_user_idx").on(table.organizationId, table.userId),
    index("user_skills_type_idx").on(table.organizationId, table.skillType),
  ],
);

/**
 * Routing rules — deterministic, explainable routing configuration for
 * territory- and skill-based lead assignment (Phase 10).
 */
export const routingRules = pgTable(
  "routing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    strategy: varchar("strategy", { length: 32 }).notNull(), // territory | skill
    priority: integer("priority").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    conditionField: varchar("condition_field", { length: 64 }).notNull(),
    conditionValue: varchar("condition_value", { length: 128 }).notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("routing_rules_org_idx").on(
      table.organizationId,
      table.strategy,
      table.active,
    ),
  ],
);
