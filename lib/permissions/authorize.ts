import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  userRoles,
  roles,
  rolePermissions,
  permissions,
} from "@/db/schema";
import { ForbiddenError } from "@/lib/errors";
import type { AuthSession } from "@/lib/auth/session";
import type { Permission, RoleName } from "./index";

/**
 * Server-side authorization service.
 *
 * Resolves a user's roles → permissions for their organization, and exposes
 * `requirePermission` for route handlers / server components. The tenant is
 * derived from the authenticated session (never client-supplied).
 */

export async function getUserRoleNames(
  userId: string,
  organizationId: string,
): Promise<RoleName[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.organizationId, organizationId)));

  return rows.map((r) => r.name as RoleName);
}

export async function getUserPermissions(
  userId: string,
  organizationId: string,
): Promise<Set<Permission>> {
  const rows = await db
    .select({ resource: permissions.resource, action: permissions.action })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), eq(roles.organizationId, organizationId)));

  return new Set<Permission>(
    rows.map((r) => `${r.resource}.${r.action}` as Permission),
  );
}

export async function userHasPermission(
  userId: string,
  organizationId: string,
  permission: Permission,
): Promise<boolean> {
  const perms = await getUserPermissions(userId, organizationId);
  return perms.has(permission);
}

/**
 * Require a permission for the authenticated session. Throws ForbiddenError
 * when the user is unauthenticated or lacks the permission.
 */
export async function requirePermission(
  session: AuthSession | null,
  permission: Permission,
): Promise<AuthSession> {
  if (!session) {
    throw new ForbiddenError("Authentication required.");
  }
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    permission,
  );
  if (!allowed) {
    throw new ForbiddenError(
      "You do not have permission to perform this action.",
    );
  }
  return session;
}
