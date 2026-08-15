import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { BaseService } from "./base";
import { users, userRoles, roles } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getUserRoleNames } from "@/lib/permissions/authorize";
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
          or(
            ilike(users.fullName, `%${params.search}%`),
            ilike(users.email, `%${params.search}%`),
          )!,
        )
      : eq(users.organizationId, this.organizationId);

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
      throw new NotFoundError("Invitation is invalid or already used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenError("Invitation has expired.");
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
    const target = await db.query.users.findFirst({
      where: and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)),
    });
    if (!target) throw new NotFoundError("User not found.");

    // Prevent self-deactivation / self-suspension.
    if (actor.userId === targetUserId && status !== "active") {
      throw new ForbiddenError("You cannot deactivate your own account.");
    }

    // Prevent deactivating the last active admin.
    if (status !== "active" && target.status === "active") {
      const targetRoles = await getUserRoleNames(targetUserId, this.organizationId);
      if (targetRoles.includes("Super Admin") || targetRoles.includes("Admin")) {
        const activeAdmins = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(userRoles, eq(userRoles.userId, users.id))
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(
            and(
              eq(users.organizationId, this.organizationId),
              eq(users.status, "active"),
              or(eq(roles.name, "Super Admin"), eq(roles.name, "Admin"))!,
            ),
          );
        if (activeAdmins.length <= 1) {
          throw new ForbiddenError("Cannot deactivate the last active administrator.");
        }
      }
    }

    const [row] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(users.id, targetUserId), eq(users.organizationId, this.organizationId)))
      .returning();

    await recordAudit({
      organizationId: this.organizationId,
      userId: actor.userId,
      action: "status_change",
      entityType: "user",
      entityId: targetUserId,
      metadata: { from: target.status, to: status },
    });
    return row;
  }
}
