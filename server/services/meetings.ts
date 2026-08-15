import { BaseService } from "./base";
import { MeetingRepository } from "@/server/repositories/meetings";
import { ActivityService } from "./activities";
import { NotificationService } from "./notifications";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateMeetingInput,
  MeetingFilter,
  MeetingStatusInput,
  UpdateMeetingInput,
} from "@/lib/operations/schemas";

const DEFAULT_SORT: Sort<"scheduledAt"> = { column: "scheduledAt", order: "asc" };

export class MeetingService extends BaseService {
  private readonly repo: MeetingRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new MeetingRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: MeetingFilter;
  }) {
    const sort: Sort<"scheduledAt"> =
      (input.sort as Sort<"scheduledAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.list({
      pagination: input.pagination,
      sort,
      search: input.search,
      filters: input.filters,
    });
  }

  async getById(id: string) {
    const meeting = await this.repo.findById(id);
    if (!meeting) throw new NotFoundError("Meeting not found.");
    const participants = await this.repo.listParticipants(id);
    return { ...meeting, participants };
  }

  private async validateOrganizer(organizerId?: string | null) {
    if (!organizerId) return;
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(
        sql`${users.id} = ${organizerId} AND ${users.organizationId} = ${this.repo.orgId} AND ${users.isDeleted} = false`,
      )
      .limit(1);
    if (!user) throw new ValidationError("Organizer must belong to this organization.");
    if (user.status !== "active") throw new ValidationError("Organizer must be an active user.");
  }

  async create(actor: { userId: string }, input: CreateMeetingInput) {
    await this.validateOrganizer(input.organizerId ?? actor.userId);

    const meeting = await this.repo.create({
      title: input.title,
      description: input.description ?? null,
      scheduledAt: new Date(input.scheduledAt),
      durationMinutes: input.durationMinutes ?? null,
      organizerId: input.organizerId ?? actor.userId,
      leadId: input.leadId ?? null,
      virtualLink: input.virtualLink ?? null,
      status: input.status,
      agenda: input.agenda ?? null,
      notes: input.notes ?? null,
      outcome: input.outcome ?? null,
      actionItems: input.actionItems ?? null,
    });

    if (input.participants?.length) {
      await this.repo.replaceParticipants(meeting.id, input.participants);
    }

    await new ActivityService(this.repo.orgId).recordActivity({
      type: "meeting",
      subject: input.title,
      leadId: input.leadId ?? null,
      performedBy: actor.userId,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "meeting",
      entityId: meeting.id,
    });

    return this.getById(meeting.id);
  }

  async update(
    actor: { userId: string },
    id: string,
    input: UpdateMeetingInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Meeting not found.");

    if (input.organizerId !== undefined) {
      await this.validateOrganizer(input.organizerId);
    }

    const patch: Parameters<typeof this.repo.update>[1] = {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: new Date(input.scheduledAt) }
        : {}),
      description:
        input.description !== undefined ? input.description : existing.description,
      durationMinutes:
        input.durationMinutes !== undefined
          ? input.durationMinutes
          : existing.durationMinutes,
      organizerId:
        input.organizerId !== undefined ? input.organizerId : existing.organizerId,
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      virtualLink:
        input.virtualLink !== undefined ? input.virtualLink : existing.virtualLink,
      agenda: input.agenda !== undefined ? input.agenda : existing.agenda,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      outcome: input.outcome !== undefined ? input.outcome : existing.outcome,
      actionItems:
        input.actionItems !== undefined ? input.actionItems : existing.actionItems,
    };

    await this.repo.update(id, patch);

    if (input.participants !== undefined) {
      await this.repo.replaceParticipants(id, input.participants ?? []);
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "meeting",
      entityId: id,
    });

    return this.getById(id);
  }

  async changeStatus(
    actor: { userId: string },
    id: string,
    input: MeetingStatusInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Meeting not found.");

    await this.repo.update(id, { status: input.status });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "meeting",
      entityId: id,
      metadata: { from: existing.status, to: input.status },
    });

    return this.getById(id);
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Meeting not found.");

    await this.repo.archive(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "meeting",
      entityId: id,
    });

    return { id };
  }

  /** Send upcoming-meeting reminders to internal participants. */
  async sendReminders(id: string) {
    const meeting = await this.repo.findById(id);
    if (!meeting) throw new NotFoundError("Meeting not found.");

    const participants = await this.repo.listParticipants(id);
    const notify = new NotificationService(this.repo.orgId);

    for (const p of participants) {
      if (!p.userId) continue;
      await notify.notify({
        userId: p.userId,
        type: "meeting_reminder",
        title: `Upcoming meeting: ${meeting.title}`,
        message: `Scheduled for ${meeting.scheduledAt.toISOString()}.`,
        entityType: "meeting",
        entityId: id,
      });
    }

    return { reminded: participants.filter((p) => p.userId).length };
  }
}
