/**
 * Centralized RBAC permission definitions.
 *
 * Permissions use the `resource.action` format and are the single source of
 * truth for authorization across the application. Do not scatter permission
 * strings in components, routes, or queries.
 */

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "assign",
  "approve",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_RESOURCES = [
  "dashboard",
  "leads",
  "clients",
  "contacts",
  "opportunities",
  "pipeline",
  "activities",
  "tasks",
  "meetings",
  "proposals",
  "documents",
  "reports",
  "analytics",
  "notifications",
  "users",
  "roles",
  "settings",
  "audit_logs",
  "ai_insights",
  "organization",
  // Phase 16 administrative resources
  "billing",
  "lead_statuses",
  "lead_sources",
  "invitations",
  "platform",
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export type Permission = `${PermissionResource}.${PermissionAction}`;

export const ROLE_NAMES = [
  "Super Admin",
  "Admin",
  "Sales Manager",
  "Sales Executive",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

/** Rank for privilege-escalation protection (higher = more privileged). */
export const ROLE_RANK: Record<RoleName, number> = {
  "Super Admin": 4,
  Admin: 3,
  "Sales Manager": 2,
  "Sales Executive": 1,
};

function perm(resource: PermissionResource, ...actions: PermissionAction[]): Permission[] {
  return actions.map((a) => `${resource}.${a}` as Permission);
}

/**
 * Role → permission matrix. The single source of truth for what each role can
 * do. Authorization is based on explicit permissions (not hierarchy alone).
 */
export const ROLE_PERMISSION_MATRIX: Record<RoleName, ReadonlySet<Permission>> = {
  "Super Admin": new Set<Permission>([
    ...perm(
      "dashboard",
      "view",
    ),
    ...perm("organization", "view", "edit"),
    ...perm("users", "view", "create", "edit", "delete", "assign"),
    ...perm("roles", "view", "create", "edit", "delete", "assign"),
    ...perm("settings", "view", "edit"),
    ...perm("audit_logs", "view", "export"),
    ...perm("billing", "view", "edit"),
    ...perm("lead_statuses", "view", "create", "edit", "delete"),
    ...perm("lead_sources", "view", "create", "edit", "delete"),
    ...perm("invitations", "view", "create", "edit", "delete"),
    ...perm("leads", "view", "create", "edit", "delete", "export", "assign", "approve"),
    ...perm("clients", "view", "create", "edit", "delete", "export", "assign", "approve"),
    ...perm("contacts", "view", "create", "edit", "delete", "export", "assign", "approve"),
    ...perm("opportunities", "view", "create", "edit", "delete", "export", "assign", "approve"),
    ...perm("pipeline", "view", "edit"),
    ...perm("activities", "view", "create", "edit", "delete"),
    ...perm("tasks", "view", "create", "edit", "delete", "assign"),
    ...perm("meetings", "view", "create", "edit", "delete", "assign"),
    ...perm("proposals", "view", "create", "edit", "delete", "approve"),
    ...perm("documents", "view", "create", "edit", "delete", "export"),
    ...perm("reports", "view", "export"),
    ...perm("analytics", "view", "export"),
    ...perm("notifications", "view"),
    ...perm("ai_insights", "view"),
  ]),
  Admin: new Set<Permission>([
    ...perm("dashboard", "view"),
    ...perm("organization", "view"),
    ...perm("users", "view", "create", "edit", "assign"),
    ...perm("roles", "view", "assign"),
    ...perm("settings", "view", "edit"),
    ...perm("audit_logs", "view"),
    ...perm("billing", "view"),
    ...perm("lead_statuses", "view", "edit"),
    ...perm("lead_sources", "view", "edit"),
    ...perm("invitations", "view", "create", "edit"),
    ...perm("leads", "view", "create", "edit", "delete", "export", "assign", "approve"),
    ...perm("clients", "view", "create", "edit", "export", "assign", "approve"),
    ...perm("contacts", "view", "create", "edit", "export", "assign"),
    ...perm("opportunities", "view", "create", "edit", "export", "assign", "approve"),
    ...perm("pipeline", "view", "edit"),
    ...perm("activities", "view", "create", "edit"),
    ...perm("tasks", "view", "create", "edit", "delete", "assign"),
    ...perm("meetings", "view", "create", "edit", "assign"),
    ...perm("proposals", "view", "create", "edit", "approve"),
    ...perm("documents", "view", "create", "edit", "delete", "export"),
    ...perm("reports", "view", "export"),
    ...perm("analytics", "view", "export"),
    ...perm("notifications", "view"),
    ...perm("ai_insights", "view"),
  ]),
  "Sales Manager": new Set<Permission>([
    ...perm("dashboard", "view"),
    ...perm("organization", "view"),
    ...perm("leads", "view", "create", "edit", "export", "assign"),
    ...perm("clients", "view", "create", "edit", "export", "assign"),
    ...perm("contacts", "view", "create", "edit", "export", "assign"),
    ...perm("opportunities", "view", "create", "edit", "export", "assign"),
    ...perm("pipeline", "view"),
    ...perm("activities", "view", "create", "edit"),
    ...perm("tasks", "view", "create", "edit", "assign"),
    ...perm("meetings", "view", "create", "edit", "assign"),
    ...perm("proposals", "view", "create", "edit"),
    ...perm("documents", "view", "create", "edit"),
    ...perm("reports", "view", "export"),
    ...perm("analytics", "view"),
    ...perm("notifications", "view"),
    ...perm("ai_insights", "view"),
  ]),
  "Sales Executive": new Set<Permission>([
    ...perm("dashboard", "view"),
    ...perm("leads", "view", "create", "edit"),
    ...perm("clients", "view", "create", "edit"),
    ...perm("contacts", "view", "create", "edit"),
    ...perm("opportunities", "view", "create", "edit"),
    ...perm("pipeline", "view"),
    ...perm("activities", "view", "create"),
    ...perm("tasks", "view", "create", "edit"),
    ...perm("meetings", "view", "create"),
    ...perm("proposals", "view"),
    ...perm("documents", "view"),
    ...perm("notifications", "view"),
  ]),
};

/** All permission strings, for seeding and validation. */
export const ALL_PERMISSIONS: Permission[] = [
  ...new Set(
    PERMISSION_RESOURCES.flatMap((resource) =>
      PERMISSION_ACTIONS.map((action) => `${resource}.${action}` as Permission),
    ),
  ),
];

export function hasPermission(
  role: RoleName,
  permission: Permission,
): boolean {
  return ROLE_PERMISSION_MATRIX[role].has(permission);
}
