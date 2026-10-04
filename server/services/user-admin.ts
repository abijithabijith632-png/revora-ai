import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { BaseService } from "./base";
import { sessions, users, userRoles, roles } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { InvitationRepository } from "@/server/repositories/invitations";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type UserStatus = NonNullable<typeof users.$inferInsert.status>;

/**
 * User administration service (Phase 16).
 * Extends Phase 5 RBAC with invite, edit, activate/deactivate/suspend, search,
 * and privilege-escalation + last-admin protections.
 */
export class UserAdminService extends BaseService {
  constructor(protected readonly organizationId: string) {
    super();
  }

  async list(params: { search?: string; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 25, 100);
    const offset = (page - 1) * pageSize;

    const where = params.search
      ? and(
          eq(users.organizationId, this.organizationId),
          eq(users.isDeleted, false),
          or(
            ilike(users.fullName, `%${params.search}%`),
            ilike(users.email, `%${params.search}%`),
          )!,
        )
      : and(
          eq(users.organizationId, this.organizationId),
          eq(users.isDeleted, false),
        );

    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        jobTitle: users.jobTitle,
        department: users.department,
        designation: users.designation,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        isPlatformAdmin: users.isPlatformAdmin,
      })
      .from(users)
      .where(where)
      .orderBy(users.fullName)
      .limit(pageSize)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where);

    const roleLinks = await db
      .select({ userId: userRoles.userId, roleId: userRoles.roleId, roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(roles.organizationId, this.organizationId));

    const withRoles = rows.map((u) => ({
      ...u,
      roles: roleLinks
        .filter((r) => r.userId === u.id)
        .map((r) => ({ id: r.roleId, name: r.roleName })),
    }));

    return {
      rows: withRoles,
      total: countRow?.count ?? 0,
      page,
      pageSize,
    };
  }

  async invite(
    actor: { userId: string; roleNames: string[] },
    input: { email: string; roleId: string | null },
  ) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });
    if (existingUser) throw new ConflictError("A user with this email already exists.");

    // Role must belong to this org.
    if (input.roleId) {
      const role = await db.query.roles.findFirst({
        where: and(eq(roles.id, input.roleId), eq(roles.organizationId, this.organizationId)),
      });
      if (!role) throw new NotFoundError("Role not found.");
    }

    const rawToken = generateToken();
    const repo = new InvitationRepository(this.organizationId);
    const invite = await repo.create({
      email: input.email,
      roleId: input.roleId,
      tokenHash: hashToken(rawToken),
      invitedBy: actor.userId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });

    await recordAudit({
      organizationId: this.organizationId,
      userId: actor.userId,
      action: "create",
      entityType: "invitation",
      entityId: invite.id,
      metadata: { email: input.email },
    });

    // Raw token returned once (invitation link); never stored.
    return { invitationId: invite.id, token: rawToken };
  }

  async acceptInvitation(token: string, input: { fullName: string; password: string }) {
    const repo = new InvitationRepository(this.organizationId);
    const invite = await repo.findByTokenHash(hashToken(token));
    if (!invite || invite.status !== "pending") {
      throw new NotFoundError("Invitation is invalid, expired, or already used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new NotFoundError("Invitation is invalid, expired, or already used.");
    }

    const passwordHash = hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({
        organizationId: invite.organizationId,
        email: invite.email,
        fullName: input.fullName,
        status: "active",
        passwordHash,
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    if (invite.roleId) {
      await db.insert(userRoles).values({ userId: user.id, roleId: invite.roleId });
    }

    await repo.markAccepted(hashToken(token));
    await recordAudit({
      organizationId: invite.organizationId,
      userId: user.id,
      action: "create",
      entityType: "user",
      entityId: user.id,
      metadata: { via: "invitation" },
    });

    return { userId: user.id };
  }

  async updateUser(
    actor: { userId: string; roleNames: string[] },
    targetUserId: string,
    input: { fullName?: string; jobTitle?: string | null; department?: string | null; designation?: string | null },
  ) {
    const target = await db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)),
    });
    if (!target) throw new NotFoundError("User not found.");

    const [row] = await db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)))
      .returning();

    await recordAudit({
      organizationId: this.organizationId,
      userId: actor.userId,
      action: "update",
      entityType: "user",
      entityId: targetUserId,
      metadata: { fields: Object.keys(input) },
    });
    return row;
  }

  async changeStatus(
    actor: { userId: string; roleNames: string[] },
    targetUserId: string,
    status: UserStatus,
  ) {
    // Prevent self-deactivation / self-suspension.
    if (actor.userId === targetUserId && status !== "active") {
      throw new ForbiddenError("You cannot deactivate your own account.");
    }

    const row = await db.transaction(async (tx) => {
      const [target] = await tx.select().from(users)
        .where(and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId), eq(users.isDeleted, false)))
        .for("update");
      if (!target) throw new NotFoundError("User not found.");

      if (status !== "active" && target.status === "active") {
        const adminRoleUsers = tx.select({ userId: userRoles.userId })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(and(eq(roles.organizationId, this.organizationId), or(eq(roles.name, "Admin"), eq(roles.name, "Super Admin"))!));
        const activeAdmins = await tx.select({ id: users.id }).from(users)
          .where(and(eq(users.organizationId, this.organizationId), eq(users.status, "active"), eq(users.isDeleted, false), inArray(users.id, adminRoleUsers)))
          .for("update");
        if (activeAdmins.length <= 1 && activeAdmins.some((admin) => admin.id === targetUserId)) {
          throw new ForbiddenError("Cannot deactivate the last active administrator.");
        }
      }

      const [updated] = await tx.update(users).set({ status, updatedAt: new Date() })
        .where(and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)))
        .returning();
      return { target, updated };
    });

    await recordAudit({
      organizationId: this.organizationId,
      userId: actor.userId,
      action: "status_change",
      entityType: "user",
      entityId: targetUserId,
      metadata: { from: row.target.status, to: status },
    });
    return row.updated;
  }

  /**
   * Remove a user from the organization (soft-delete). Clears role grants
   * and sessions so the removed user loses access immediately, while
   * preserving historical audit/assignment records. Guards self-removal
   * and the last active administrator.
   */
  async remove(
    actor: { userId: string; roleNames: string[] },
    targetUserId: string,
  ) {
    const target = await db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)),
    });
    if (!target || target.isDeleted) throw new NotFoundError("User not found.");

    if (actor.userId === targetUserId) {
      throw new ForbiddenError("You cannot remove your own account.");
    }

    await db.transaction(async (tx) => {
      const adminRoleUsers = tx.select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(eq(roles.organizationId, this.organizationId), or(eq(roles.name, "Admin"), eq(roles.name, "Super Admin"))!));
      const activeAdmins = await tx.select({ id: users.id }).from(users)
        .where(and(eq(users.organizationId, this.organizationId), eq(users.status, "active"), eq(users.isDeleted, false), inArray(users.id, adminRoleUsers)))
        .for("update");
      if (activeAdmins.some((admin) => admin.id === targetUserId) && activeAdmins.length <= 1) {
        throw new ForbiddenError("Cannot remove the last active administrator.");
      }
      await tx
        .update(users)
        .set({ isDeleted: true, deletedAt: new Date(), status: "inactive", updatedAt: new Date() })
        .where(and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)));
      await tx.delete(userRoles).where(eq(userRoles.userId, targetUserId));
      await tx.delete(sessions).where(eq(sessions.userId, targetUserId));
    });

    await recordAudit({
      organizationId: this.organizationId,
      userId: actor.userId,
      action: "delete",
      entityType: "user",
      entityId: targetUserId,
      metadata: { email: target.email },
    });
    return { id: targetUserId };
  }
}
