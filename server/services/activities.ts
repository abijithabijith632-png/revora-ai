import { and, eq } from "drizzle-orm";
import { BaseService } from "./base";
import { ActivityRepository } from "@/server/repositories/activities";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError } from "@/lib/errors";
import { NotificationService } from "./notifications";
import { db } from "@/db";
import { clients, contacts, leads, opportunities } from "@/db/schema";
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

  private async validateRelations(input: {
    leadId?: string | null;
    clientId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
  }) {
    const checks: Promise<unknown>[] = [];
    if (input.leadId) checks.push(db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, input.leadId), eq(leads.organizationId, this.repo.orgId))).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Lead not found in this organization."); }));
    if (input.clientId) checks.push(db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.organizationId, this.repo.orgId))).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Client not found in this organization."); }));
    if (input.contactId) checks.push(db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, input.contactId), eq(contacts.organizationId, this.repo.orgId))).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Contact not found in this organization."); }));
    if (input.opportunityId) checks.push(db.select({ id: opportunities.id }).from(opportunities).where(and(eq(opportunities.id, input.opportunityId), eq(opportunities.organizationId, this.repo.orgId))).limit(1).then((r) => { if (!r[0]) throw new NotFoundError("Opportunity not found in this organization."); }));
    await Promise.all(checks);
  }

  async create(actor: { userId: string }, input: CreateActivityInput) {
    await this.validateRelations(input);
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

    // User-logged activity update: notify the linked record's owner so
    // important activity updates surface in-app. System timeline writes via
    // recordActivity stay silent to avoid duplicate notifications.
    try {
      const targets: Array<{ userId: string; entityType: string; entityId: string }> = [];
      if (input.leadId) {
        const [row] = await db
          .select({ ownerId: leads.ownerId })
          .from(leads)
          .where(and(eq(leads.id, input.leadId), eq(leads.organizationId, this.repo.orgId)))
          .limit(1);
        if (row?.ownerId && row.ownerId !== actor.userId) {
          targets.push({ userId: row.ownerId, entityType: "lead", entityId: input.leadId });
        }
      }
      if (input.opportunityId) {
        const [row] = await db
          .select({ ownerId: opportunities.ownerId })
          .from(opportunities)
          .where(and(eq(opportunities.id, input.opportunityId), eq(opportunities.organizationId, this.repo.orgId)))
          .limit(1);
        if (row?.ownerId && row.ownerId !== actor.userId) {
          targets.push({ userId: row.ownerId, entityType: "opportunity", entityId: input.opportunityId });
        }
      }
      if (input.clientId) {
        const [row] = await db
          .select({ accountManagerId: clients.accountManagerId })
          .from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, this.repo.orgId)))
          .limit(1);
        if (row?.accountManagerId && row.accountManagerId !== actor.userId) {
          targets.push({ userId: row.accountManagerId, entityType: "client", entityId: input.clientId });
        }
      }
      const notify = new NotificationService(this.repo.orgId);
      for (const t of targets) {
        await notify.notify({
          userId: t.userId,
          type: "important_deal_update",
          title: "New activity update",
          message: `${activity.type}${activity.subject ? `: ${activity.subject}` : ""} was logged.`,
          entityType: t.entityType,
          entityId: t.entityId,
        });
      }
    } catch {
      // Notifications must never break activity logging.
    }

    return activity;
  }

  async update(
    actor: { userId: string },
    id: string,
    input: UpdateActivityInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Activity not found.");

    await this.validateRelations({
      leadId: input.leadId !== undefined ? input.leadId : existing.leadId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      contactId: input.contactId !== undefined ? input.contactId : existing.contactId,
      opportunityId: input.opportunityId !== undefined ? input.opportunityId : existing.opportunityId,
    });

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
