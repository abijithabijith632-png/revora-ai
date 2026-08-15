import { BaseService } from "./base";
import { ActivityRepository } from "@/server/repositories/activities";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError } from "@/lib/errors";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  ActivityFilter,
  CreateActivityInput,
  UpdateActivityInput,
} from "@/lib/operations/schemas";

const DEFAULT_SORT: Sort<"occurredAt"> = { column: "occurredAt", order: "desc" };

/**
 * Activity business logic — CRUD and the unified timeline feed used by
 * client/opportunity detail pages. Other services call `recordActivity` to
 * append events to the shared timeline without duplicating activity logic.
 */
export class ActivityService extends BaseService {
  private readonly repo: ActivityRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new ActivityRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: ActivityFilter;
  }) {
    const sort: Sort<"occurredAt"> =
      (input.sort as Sort<"occurredAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.list({
      pagination: input.pagination,
      sort,
      search: input.search,
      filters: input.filters,
    });
  }

  async timeline(
    entityType: "lead" | "client" | "contact" | "opportunity",
    entityId: string,
  ) {
    return this.repo.listTimeline(entityType, entityId);
  }

  async getById(id: string) {
    const activity = await this.repo.findById(id);
    if (!activity) throw new NotFoundError("Activity not found.");
    return activity;
  }

  async create(actor: { userId: string }, input: CreateActivityInput) {
    const activity = await this.repo.create({
      type: input.type,
      subject: input.subject ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? null,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
      performedBy: actor.userId,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "activity",
      entityId: activity.id,
      metadata: { type: activity.type },
    });

    return activity;
  }

  async update(
    actor: { userId: string },
    id: string,
    input: UpdateActivityInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Activity not found.");

    const patch: Parameters<typeof this.repo.update>[1] = {
      ...(input.type !== undefined ? { type: input.type } : {}),
      subject: input.subject !== undefined ? input.subject : existing.subject,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      metadata: input.metadata !== undefined ? input.metadata : existing.metadata,
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      contactId: input.contactId !== undefined ? input.contactId : existing.contactId,
      opportunityId:
        input.opportunityId !== undefined
          ? input.opportunityId
          : existing.opportunityId,
      ...(input.occurredAt !== undefined
        ? { occurredAt: new Date(input.occurredAt) }
        : {}),
    };

    const updated = await this.repo.update(id, patch);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "activity",
      entityId: id,
    });

    return updated;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Activity not found.");

    await this.repo.archive(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "activity",
      entityId: id,
    });

    return { id };
  }

  /** Shared helper: append an event to the unified timeline. */
  async recordActivity(input: {
    type: CreateActivityInput["type"];
    subject?: string | null;
    notes?: string | null;
    metadata?: unknown;
    leadId?: string | null;
    clientId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
    performedBy?: string | null;
  }) {
    return this.repo.create({
      type: input.type,
      subject: input.subject ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? null,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
      performedBy: input.performedBy ?? null,
    });
  }
}
