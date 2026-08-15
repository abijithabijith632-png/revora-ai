import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { TenantRepository } from "./base";
import {
  notifications,
  userNotificationPreferences,
} from "@/db/schema";
import type { Pagination } from "@/lib/api/query";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

/**
 * Centralized notification repository. A single code path (see
 * `NotificationService.notify`) writes here — no per-feature notification
 * logic scattered across services.
 */
export class NotificationRepository extends TenantRepository {
  private baseWhere(userId: string): SQL {
    return and(
      eq(notifications.organizationId, this.organizationId),
      eq(notifications.userId, userId),
    )!;
  }

  async listForUser(userId: string, pagination: Pagination) {
    const where = this.baseWhere(userId);

    const rows = await this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        isRead: notifications.isRead,
        relatedEntityType: notifications.relatedEntityType,
        relatedEntityId: notifications.relatedEntityId,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pagination.pageSize)
      .offset(pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          this.baseWhere(userId),
          eq(notifications.isRead, false),
        ),
      );
    return row?.count ?? 0;
  }

  async create(input: {
    userId: string;
    type: string;
    title: string;
    message?: string | null;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
  }) {
    const [row] = await this.db
      .insert(notifications)
      .values({
        organizationId: this.organizationId,
        userId: input.userId,
        type: input.type as never,
        title: input.title,
        message: input.message ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      })
      .returning();
    return row;
  }

  async markRead(userId: string, id: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), this.baseWhere(userId)))
      .returning();
    return row;
  }

  async markAllRead(userId: string) {
    const rows = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(this.baseWhere(userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return rows;
  }

  /* -------------------------------------------------------------
   * Preferences
   * ------------------------------------------------------------ */
  async getPreferences(userId: string) {
    const [row] = await this.db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.organizationId, this.organizationId),
          eq(userNotificationPreferences.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertPreferences(
    userId: string,
    input: {
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
      types?: Record<string, boolean>;
    },
  ) {
    const existing = await this.getPreferences(userId);

    if (!existing) {
      const [row] = await this.db
        .insert(userNotificationPreferences)
        .values({
          organizationId: this.organizationId,
          userId,
          emailEnabled: input.emailEnabled ?? true,
          inAppEnabled: input.inAppEnabled ?? true,
          types: input.types ?? null,
        })
        .returning();
      return row;
    }

    const [row] = await this.db
      .update(userNotificationPreferences)
      .set({
        ...(input.emailEnabled !== undefined
          ? { emailEnabled: input.emailEnabled }
          : {}),
        ...(input.inAppEnabled !== undefined
          ? { inAppEnabled: input.inAppEnabled }
          : {}),
        ...(input.types !== undefined ? { types: input.types } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userNotificationPreferences.organizationId, this.organizationId),
          eq(userNotificationPreferences.userId, userId),
        ),
      )
      .returning();
    return row;
  }
}
