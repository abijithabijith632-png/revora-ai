import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { createdAt } from "./common";

/**
 * RBAC foundation — roles, permissions, and join tables.
 *
 * Enforcement belongs to Phase 5. This schema provides the relational model:
 * - `roles` are tenant-owned (Super Admin / Admin / Sales Manager / Sales Executive).
 * - `permissions` are system-wide capability vocabulary (view/create/edit/delete/export/assign/approve).
 * - `role_permissions` grant permissions to roles.
 * - `user_roles` assign roles to users.
 */

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 64 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("roles_org_name_idx").on(table.organizationId, table.name),
    index("roles_org_idx").on(table.organizationId),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // e.g. "leads", "clients", "opportunities", "reports"
    resource: varchar("resource", { length: 64 }).notNull(),
    // e.g. "view", "create", "edit", "delete", "export", "assign", "approve"
    action: varchar("action", { length: 32 }).notNull(),
    createdAt,
  },
  (table) => [uniqueIndex("permissions_resource_action_idx").on(table.resource, table.action)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    index("role_permissions_permission_idx").on(table.permissionId),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index("user_roles_role_idx").on(table.roleId),
  ],
);

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
