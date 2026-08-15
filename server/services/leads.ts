import { sql } from "drizzle-orm";
import { BaseService } from "./base";
import { LeadRepository } from "@/server/repositories/leads";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { canTransition, QUALIFICATION_GATED_STATUSES } from "@/lib/leads/lifecycle";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  AssignLeadInput,
  CreateLeadInput,
  LeadFilter,
  LeadStatus,
  UpdateLeadInput,
  UpdateLeadStatusInput,
} from "@/lib/leads/schemas";

/**
 * Lead business logic. Orchestrates the repository, enforces business rules,
 * synchronizes structured names with the legacy full_name, writes status
 * history and assignment history, and records audit events.
 */

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

function buildFullName(firstName: string, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function toDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

export class LeadService extends BaseService {
  private readonly repo: LeadRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new LeadRepository(organizationId);
  }

  /** Format: LD-YYYY-XXXX with a per-tenant collision guard. */
  private async nextLeadNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `LD-${year}-`;

    const [row] = await db
      .select({ max: sql<string>`max(lead_number)` })
      .from(leads)
      .where(
        sql`${leads.organizationId} = ${this.repo.orgId} AND lead_number LIKE ${`${prefix}%`}`,
      );

    const max = row?.max ?? null;
    const lastNumber = max ? Number(max.slice(prefix.length)) : 0;
    const next = lastNumber + 1;

    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: LeadFilter;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;

    const { rows, total } = await this.repo.list({
      pagination: input.pagination,
      sort,
      search: input.search,
      filters: input.filters,
    });

    return { rows, total };
  }

  async summary() {
    const [total, byStatus, bySource] = await Promise.all([
      this.repo.countActive(),
      this.repo.summaryByStatus(),
      this.repo.summaryBySource(),
    ]);

    const statusCount: Record<string, number> = {};
    for (const s of byStatus) statusCount[s.status] = s.count;
    const sourceCount: Record<string, number> = {};
    for (const s of bySource) sourceCount[s.source] = s.count;

    return { total, byStatus: statusCount, bySource: sourceCount };
  }

  async getById(id: string) {
    const lead = await this.repo.findById(id);
    if (!lead) throw new NotFoundError("Lead not found.");

    const history = await this.repo.statusHistory(id);

    return { ...lead, statusHistory: history };
  }

  async create(actor: { userId: string }, input: CreateLeadInput) {
    const firstName = input.firstName.trim();
    const lastName = input.lastName?.trim() || null;
    const fullName = buildFullName(firstName, lastName);

    if (!fullName) {
      throw new ConflictError("Lead name is required.");
    }

    const leadNumber = await this.nextLeadNumber();

    const lead = await this.repo.create({
      leadNumber,
      firstName,
      lastName,
      fullName,
      email: input.email,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      companyName: input.companyName,
      industry: input.industry,
      companySize: input.companySize,
      geography: input.geography,
      website: input.website,
      source: input.source,
      status: input.status,
      ownerId: input.ownerId,
      budget: input.budget,
      expectedClosingDate: toDate(input.expectedClosingDate),
      interestedProduct: input.interestedProduct,
      notes: input.notes,
    });

    // Initial status history entry (from null → current).
    await this.repo.insertStatusHistory({
      leadId: lead.id,
      fromStatus: null,
      toStatus: lead.status,
      changedBy: actor.userId,
    });

    if (lead.ownerId) {
      await this.repo.insertAssignment({
        leadId: lead.id,
        assignedTo: lead.ownerId,
        assignedBy: actor.userId,
        strategy: "manual",
      });
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "lead",
      entityId: lead.id,
      metadata: { leadNumber },
    });

    return lead;
  }

  async update(actor: { userId: string }, id: string, input: UpdateLeadInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Lead not found.");

    const firstName = input.firstName ?? existing.firstName ?? "";
    const lastName = input.lastName !== undefined ? input.lastName : existing.lastName;
    const fullName = buildFullName(firstName, lastName);

    const patch = {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined
        ? { lastName: input.lastName.trim() || null }
        : {}),
      fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      alternatePhone: input.alternatePhone ?? null,
      companyName: input.companyName ?? null,
      industry: input.industry ?? null,
      companySize: input.companySize ?? null,
      geography: input.geography ?? null,
      website: input.website ?? null,
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      budget: input.budget !== undefined ? input.budget : existing.budget,
      expectedClosingDate:
        input.expectedClosingDate !== undefined
          ? toDate(input.expectedClosingDate)
          : existing.expectedClosingDate,
      interestedProduct: input.interestedProduct ?? null,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    const updated = await this.repo.update(id, patch);

    // Owner change → assignment history + audit.
    if (input.ownerId !== undefined && input.ownerId !== existing.ownerId) {
      await this.repo.insertAssignment({
        leadId: id,
        assignedTo: input.ownerId ?? null,
        assignedBy: actor.userId,
        strategy: "manual",
      });
      await recordAudit({
        organizationId: this.repo.orgId,
        userId: actor.userId,
        action: "assign",
        entityType: "lead",
        entityId: id,
        metadata: { from: existing.ownerId, to: input.ownerId },
      });
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "lead",
      entityId: id,
    });

    return updated;
  }

  async changeStatus(
    actor: { userId: string },
    id: string,
    input: UpdateLeadStatusInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Lead not found.");

    if (existing.status === input.status) {
      return existing;
    }

    // Enforce controlled lifecycle transitions (never trust the client).
    if (!canTransition(existing.status as LeadStatus, input.status as LeadStatus)) {
      throw new ForbiddenError("That lifecycle transition is not allowed.");
    }

    // Entering QUALIFIED requires a completed qualification assessment.
    if (
      QUALIFICATION_GATED_STATUSES.includes(input.status as LeadStatus) &&
      existing.qualificationStatus !== "qualified"
    ) {
      throw new ConflictError(
        "Qualification is required before marking this lead as Qualified.",
      );
    }

    await this.repo.update(id, { status: input.status });
    await this.repo.insertStatusHistory({
      leadId: id,
      fromStatus: existing.status,
      toStatus: input.status,
      changedBy: actor.userId,
      notes: input.notes,
      reason: input.reason ?? null,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "lead",
      entityId: id,
      metadata: { from: existing.status, to: input.status },
    });

    return this.repo.findById(id);
  }

  async assign(actor: { userId: string }, id: string, input: AssignLeadInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Lead not found.");

    if (existing.ownerId === input.ownerId) {
      return existing;
    }

    await this.repo.update(id, { ownerId: input.ownerId });
    await this.repo.insertAssignment({
      leadId: id,
      assignedTo: input.ownerId,
      previousOwnerId: existing.ownerId,
      assignedBy: actor.userId,
      strategy: input.strategy ?? "manual",
      reason: input.reason ?? null,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "assign",
      entityType: "lead",
      entityId: id,
      metadata: {
        from: existing.ownerId,
        to: input.ownerId,
        strategy: input.strategy ?? "manual",
      },
    });

    return this.repo.findById(id);
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Lead not found.");

    await this.repo.archive(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "lead",
      entityId: id,
    });

    return { id };
  }

  /** Export payload used by the export route (already org-scoped). */
  async exportRows(params: {
    sort?: Sort<string>;
    search?: string;
    filters?: LeadFilter;
    limit: number;
  }) {
    const sort: Sort<"createdAt"> =
      (params.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;

    return this.repo.exportRows(
      { sort, search: params.search, filters: params.filters },
      params.limit,
    );
  }
}
