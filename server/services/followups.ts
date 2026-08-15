import { BaseService } from "./base";
import { FollowupRepository } from "@/server/repositories/followups";
import { ActivityService } from "./activities";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateFollowupInput,
  FollowupFilter,
  FollowupStatusInput,
  UpdateFollowupInput,
} from "@/lib/operations/schemas";

const DEFAULT_SORT: Sort<"scheduledAt"> = { column: "scheduledAt", order: "asc" };

export class FollowupService extends BaseService {
  private readonly repo: FollowupRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new FollowupRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: FollowupFilter;
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

  async reminders(userId: string) {
    return this.repo.reminders(userId);
  }

  async getById(id: string) {
    const followup = await this.repo.findById(id);
    if (!followup) throw new NotFoundError("Follow-up not found.");
    return followup;
  }

  private async validateAssignee(assignedTo?: string | null) {
    if (!assignedTo) return;
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(
        sql`${users.id} = ${assignedTo} AND ${users.organizationId} = ${this.repo.orgId} AND ${users.isDeleted} = false`,
      )
      .limit(1);
    if (!user) throw new ValidationError("Assignee must belong to this organization.");
    if (user.status !== "active") throw new ValidationError("Assignee must be an active user.");
  }

  async create(actor: { userId: string }, input: CreateFollowupInput) {
    await this.validateAssignee(input.assignedTo ?? actor.userId);

    const followup = await this.repo.create({
      clientId: input.clientId,
      opportunityId: input.opportunityId ?? null,
      leadId: input.leadId ?? null,
      contactId: input.contactId ?? null,
      assignedTo: input.assignedTo ?? actor.userId,
      channel: input.channel,
      scheduledAt: new Date(input.scheduledAt),
      priority: input.priority,
      status: input.status,
      actionDescription: input.actionDescription ?? null,
      notes: input.notes ?? null,
    });

    await new ActivityService(this.repo.orgId).recordActivity({
      type: "follow_up",
      subject: input.actionDescription ?? "Follow-up scheduled",
      clientId: input.clientId,
      opportunityId: input.opportunityId ?? null,
      performedBy: actor.userId,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "followup",
      entityId: followup.id,
    });

    return followup;
  }

  async update(
    actor: { userId: string },
    id: string,
    input: UpdateFollowupInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Follow-up not found.");

    if (input.assignedTo !== undefined) {
      await this.validateAssignee(input.assignedTo);
    }

    const patch: Parameters<typeof this.repo.update>[1] = {
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: new Date(input.scheduledAt) }
        : {}),
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      opportunityId:
        input.opportunityId !== undefined
          ? input.opportunityId
          : existing.opportunityId,
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      contactId:
        input.contactId !== undefined ? input.contactId : existing.contactId,
      assignedTo:
        input.assignedTo !== undefined ? input.assignedTo : existing.assignedTo,
      actionDescription:
        input.actionDescription !== undefined
          ? input.actionDescription
          : existing.actionDescription,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    const updated = await this.repo.update(id, patch);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "followup",
      entityId: id,
    });

    return updated;
  }

  async changeStatus(
    actor: { userId: string },
    id: string,
    input: FollowupStatusInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Follow-up not found.");

    const completedAt =
      input.status === "completed" ? new Date() : existing.completedAt;

    const updated = await this.repo.update(id, {
      status: input.status,
      completedAt,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "followup",
      entityId: id,
      metadata: { from: existing.status, to: input.status },
    });

    return updated;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Follow-up not found.");

    await this.repo.update(id, { status: "cancelled" });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "followup",
      entityId: id,
    });

    return { id };
  }
}
