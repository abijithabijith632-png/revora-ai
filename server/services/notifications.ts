import { BaseService } from "./base";
import { NotificationRepository } from "@/server/repositories/notifications";
import { NotFoundError } from "@/lib/errors";
import type { Pagination } from "@/lib/api/query";
import type { NotificationPreferencesInput } from "@/lib/operations/schemas";

/**
 * Centralized notification engine. All features call `notify()` to create
 * in-app notifications through one code path, which also respects per-user
 * preferences before inserting.
 */
export class NotificationService extends BaseService {
  private readonly repo: NotificationRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new NotificationRepository(organizationId);
  }

  async list(userId: string, pagination: Pagination) {
    return this.repo.listForUser(userId, pagination);
  }

  async unreadCount(userId: string) {
    return this.repo.unreadCount(userId);
  }

  /** Create a notification, respecting the user's in-app + type preferences. */
  async notify(input: {
    userId: string;
    type: string;
    title: string;
    message?: string | null;
    entityType?: string | null;
    entityId?: string | null;
  }) {
    const prefs = await this.repo.getPreferences(input.userId);

    if (prefs && prefs.inAppEnabled === false) return null;

    if (prefs?.types && typeof prefs.types === "object") {
      const perType = (prefs.types as Record<string, boolean>)[input.type];
      if (perType === false) return null;
    }

    return this.repo.create(input);
  }

  async markRead(userId: string, id: string) {
    const row = await this.repo.markRead(userId, id);
    if (!row) throw new NotFoundError("Notification not found.");
    return row;
  }

  async markAllRead(userId: string) {
    const rows = await this.repo.markAllRead(userId);
    return { marked: rows.length };
  }

  async getPreferences(userId: string) {
    return this.repo.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    input: NotificationPreferencesInput,
  ) {
    return this.repo.upsertPreferences(userId, input);
  }
}
