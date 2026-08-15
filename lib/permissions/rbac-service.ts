import { eq, and } from "drizzle-orm";
import type { AuthSession } from "@/lib/auth/session";
import { db } from "@/db";
import {
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  auditLogs,
} from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  ROLE_RANK,
  ROLE_PERMISSION_MATRIX,
  type RoleName,
} from "./index";

/**
 * RBAC management service — org-scoped role/user listing and safe role
 * assignment with privilege-escalation protection + audit logging.
 */

export async function listOrgRoles(organizationId: string) {
  const roleRows = await db.query.roles.findMany({
    where: eq(roles.organizationId, organizationId),
    orderBy: roles.createdAt,
  });

  const permRows = await db
    .select({
      roleId: rolePermissions.roleId,
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
    .where(eq(roles.organizationId, organizationId));

  const userCounts = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(roles.organizationId, organizationId));

  const countByRole = new Map<string, number>();
  for (const c of userCounts) {
    countByRole.set(c.roleId, (countByRole.get(c.roleId) ?? 0) + 1);
  }

  return roleRows.map((role) => {
    const perms = permRows
      .filter((p) => p.roleId === role.id)
      .map((p) => `${p.resource}.${p.action}`);
    return {
      ...role,
      permissionCount: perms.length,
      permissions: perms,
      userCount: countByRole.get(role.id) ?? 0,
    };
  });
}

export async function listOrgUsers(organizationId: string) {
  const userRows = await db.query.users.findMany({
    where: eq(users.organizationId, organizationId),
    orderBy: users.fullName,
  });

  const roleLinks = await db
    .select({ userId: userRoles.userId, roleId: userRoles.roleId, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(eq(users.organizationId, organizationId));

  return userRows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    jobTitle: u.jobTitle,
    status: u.status,
    roles: roleLinks
      .filter((r) => r.userId === u.id)
      .map((r) => ({ id: r.roleId, name: r.roleName })),
  }));
}

export async function assignRole(
  actorSession: AuthSession,
  targetUserId: string,
  targetRoleId: string,
) {
  const { organizationId } = actorSession;

  // Target user must belong to the same organization.
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, targetUserId), eq(users.organizationId, organizationId)),
  });
  if (!target) throw new NotFoundError("User not found.");

  // Target role must belong to the same organization.
  const targetRole = await db.query.roles.findFirst({
    where: and(eq(roles.id, targetRoleId), eq(roles.organizationId, organizationId)),
  });
  if (!targetRole) throw new NotFoundError("Role not found.");

  // Actor must have roles.assign permission.
  const { userHasPermission, getUserRoleNames } = await import("./authorize");
  const canAssign = await userHasPermission(
    actorSession.userId,
    organizationId,
    "roles.assign",
  );
  if (!canAssign) {
    throw new ForbiddenError("You do not have permission to perform this action.");
  }

  const actorRoleNames = await getUserRoleNames(actorSession.userId, organizationId);
  const actorMaxRank = Math.max(0, ...actorRoleNames.map((r) => ROLE_RANK[r] ?? 0));

  // Prevent self-escalation: actor cannot assign a role equal/higher than self.
  const targetRank = ROLE_RANK[targetRole.name as RoleName] ?? 0;
  if (actorSession.userId === targetUserId && targetRank >= actorMaxRank) {
    throw new ForbiddenError("You cannot change your own role to a higher level.");
  }
  if (targetRank > actorMaxRank) {
    throw new ForbiddenError(
      "You cannot assign a role higher than your own privilege level.",
    );
  }

  // Replace target's roles with the single chosen role (org-scoped).
  await db.transaction(async (tx) => {
    // Remove existing roles for the user in this org.
    const existing = await tx
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, targetUserId), eq(roles.organizationId, organizationId)));

    for (const e of existing) {
      await tx.delete(userRoles).where(and(eq(userRoles.userId, targetUserId), eq(userRoles.roleId, e.roleId)));
    }

    await tx.insert(userRoles).values({ userId: targetUserId, roleId: targetRoleId });

    await tx.insert(auditLogs).values({
      organizationId,
      userId: actorSession.userId,
      action: "assign",
      entityType: "user_role",
      entityId: targetUserId,
      metadata: { targetRoleId, targetRoleName: targetRole.name },
    });
  });

  return { userId: targetUserId, roleId: targetRoleId };
}

/** Seed-safe helper: apply the canonical matrix for a role. */
export async function applyRolePermissions(roleId: string, roleName: RoleName) {
  const perms = ROLE_PERMISSION_MATRIX[roleName];
  const allPerms = await db.select().from(permissions);
  const byKey = new Map(allPerms.map((p) => [`${p.resource}.${p.action}`, p.id]));

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  for (const p of perms) {
    const permissionId = byKey.get(p);
    if (permissionId) {
      await db.insert(rolePermissions).values({ roleId, permissionId });
    }
  }
}
