import { and, eq } from "drizzle-orm";
import { TenantRepository } from "./base";
import { invitations, users, roles } from "@/db/schema";

/**
 * User invitation repository (Phase 16).
 * Stores only a token hash; raw tokens are returned once to the inviter.
 */

export class InvitationRepository extends TenantRepository {
  async list() {
    return this.db
      .select({
        id: invitations.id,
        email: invitations.email,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        createdAt: invitations.createdAt,
        invitedByName: users.fullName,
        roleName: roles.name,
      })
      .from(invitations)
      .leftJoin(users, eq(invitations.invitedBy, users.id))
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(eq(invitations.organizationId, this.organizationId));
  }

  async findByTokenHash(tokenHash: string) {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async findPendingByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, this.organizationId),
          eq(invitations.email, email),
          eq(invitations.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    email: string;
    roleId: string | null;
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
  }) {
    const [row] = await this.db
      .insert(invitations)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }

  async markAccepted(tokenHash: string) {
    const [row] = await this.db
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          eq(invitations.organizationId, this.organizationId),
        ),
      )
      .returning();
    return row;
  }

  async revoke(id: string) {
    const [row] = await this.db
      .update(invitations)
      .set({ status: "revoked" })
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.organizationId, this.organizationId),
        ),
      )
      .returning();
    return row;
  }
}
