import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import {
  leads,
  leadStatusHistory,
  leadAssignments,
  users,
  activities,
} from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { LeadFilter } from "@/lib/leads/schemas";

/**
 * Lead data access — every query is tenant-scoped via `organizationId`.
 * Never construct a query without the org equality guard.
 */

export type LeadSortColumn =
  | "createdAt"
  | "updatedAt"
  | "fullName"
  | "companyName"
  | "status"
  | "source"
  | "aiScore";

export interface LeadListParams {
  pagination: Pagination;
  sort: Sort<LeadSortColumn>;
  search?: string;
  filters?: LeadFilter;
}

export interface LeadListRow {
  id: string;
  leadNumber: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  industry: string | null;
  geography: string | null;
  source: string;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  budget: number | null;
  expectedClosingDate: Date | null;
  interestedProduct: string | null;
  aiScore: number | null;
  aiScoreCategory: string | null;
  aiScoreConfidence: number | null;
  qualificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

const SORT_COLUMNS: Record<LeadSortColumn, PgColumn> = {
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  fullName: leads.fullName,
  companyName: leads.companyName,
  status: leads.status,
  source: leads.source,
  aiScore: leads.aiScore,
};

export class LeadRepository extends TenantRepository {
  private baseWhere(): SQL {
    return and(
      eq(leads.organizationId, this.organizationId),
      eq(leads.isDeleted, false),
    )!;
  }

  private buildWhere(input: {
    search?: string;
    filters?: LeadFilter;
  }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(leads.fullName, term),
          ilike(leads.email, term),
          ilike(leads.companyName, term),
          ilike(leads.phone, term),
          ilike(leads.leadNumber, term),
        )!,
      );
    }

    const f = input.filters;
    if (f?.status) conditions.push(eq(leads.status, f.status));
    if (f?.source) conditions.push(eq(leads.source, f.source));
    if (f?.ownerId) conditions.push(eq(leads.ownerId, f.ownerId));

    return and(...conditions)!;
  }

  async list(params: LeadListParams) {
    const where = this.buildWhere({
      search: params.search,
      filters: params.filters,
    });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select({
        id: leads.id,
        leadNumber: leads.leadNumber,
        firstName: leads.firstName,
        lastName: leads.lastName,
        fullName: leads.fullName,
        email: leads.email,
        phone: leads.phone,
        companyName: leads.companyName,
        industry: leads.industry,
        geography: leads.geography,
        source: leads.source,
        status: leads.status,
        ownerId: leads.ownerId,
        budget: leads.budget,
        expectedClosingDate: leads.expectedClosingDate,
        interestedProduct: leads.interestedProduct,
        aiScore: leads.aiScore,
        aiScoreCategory: leads.aiScoreCategory,
        aiScoreConfidence: leads.aiScoreConfidence,
        qualificationStatus: leads.qualificationStatus,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        ownerName: users.fullName,
      })
      .from(leads)
      .leftJoin(users, eq(leads.ownerId, users.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(where);

    return {
      rows,
      total: countRow?.count ?? 0,
    };
  }

  async countActive(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(this.baseWhere());
    return row?.count ?? 0;
  }

  async summaryByStatus() {
    const rows = await this.db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(this.baseWhere())
      .groupBy(leads.status);

    return rows.map((r) => ({ status: r.status, count: r.count }));
  }

  async summaryBySource() {
    const rows = await this.db
      .select({
        source: leads.source,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(this.baseWhere())
      .groupBy(leads.source);

    return rows.map((r) => ({ source: r.source, count: r.count }));
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: leads.id,
        leadNumber: leads.leadNumber,
        firstName: leads.firstName,
        lastName: leads.lastName,
        fullName: leads.fullName,
        email: leads.email,
        phone: leads.phone,
        alternatePhone: leads.alternatePhone,
        companyName: leads.companyName,
        industry: leads.industry,
        companySize: leads.companySize,
        geography: leads.geography,
        website: leads.website,
        source: leads.source,
        status: leads.status,
        ownerId: leads.ownerId,
        mergedIntoId: leads.mergedIntoId,
        budget: leads.budget,
        expectedClosingDate: leads.expectedClosingDate,
        interestedProduct: leads.interestedProduct,
        notes: leads.notes,
        aiScore: leads.aiScore,
        aiScoreCategory: leads.aiScoreCategory,
        aiScoreConfidence: leads.aiScoreConfidence,
        qualificationStatus: leads.qualificationStatus,
        qualificationMetadata: leads.qualificationMetadata,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        ownerName: users.fullName,
      })
      .from(leads)
      .leftJoin(users, eq(leads.ownerId, users.id))
      .where(and(eq(leads.id, id), this.baseWhere()))
      .limit(1);

    return row ?? null;
  }

  async findIdByOrg(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.id, id),
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async create(input: {
    leadNumber: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    alternatePhone?: string | null;
    companyName?: string | null;
    industry?: string | null;
    companySize?: string | null;
    geography?: string | null;
    website?: string | null;
    source: string;
    status: string;
    ownerId?: string | null;
    budget?: number | null;
    expectedClosingDate?: Date | null;
    interestedProduct?: string | null;
    notes?: string | null;
  }) {
    const [row] = await this.db
      .insert(leads)
      .values({
        organizationId: this.organizationId,
        ...input,
        qualificationStatus: "pending",
        isDeleted: false,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      firstName: string;
      lastName: string | null;
      fullName: string;
      email: string | null;
      phone: string | null;
      alternatePhone: string | null;
      companyName: string | null;
      industry: string | null;
      companySize: string | null;
      geography: string | null;
      website: string | null;
      source: string;
      status: string;
      ownerId: string | null;
      budget: number | null;
      expectedClosingDate: Date | null;
      interestedProduct: string | null;
      notes: string | null;
    }>,
  ) {
    const [row] = await this.db
      .update(leads)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(leads.id, id), eq(leads.organizationId, this.organizationId)),
      )
      .returning();
    return row;
  }

  async archive(id: string) {
    const [row] = await this.db
      .update(leads)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(leads.id, id), eq(leads.organizationId, this.organizationId)),
      )
      .returning();
    return row;
  }

  async getEngagementSummary(leadId: string): Promise<{
    activityCount: number;
    lastActivityAt: string | null;
  }> {
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(
        and(
          eq(activities.organizationId, this.organizationId),
          eq(activities.leadId, leadId),
        ),
      );

    const [last] = await this.db
      .select({ occurredAt: activities.occurredAt })
      .from(activities)
      .where(
        and(
          eq(activities.organizationId, this.organizationId),
          eq(activities.leadId, leadId),
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(1);

    return {
      activityCount: countRow?.count ?? 0,
      lastActivityAt: last?.occurredAt?.toISOString() ?? null,
    };
  }

  async insertStatusHistory(input: {
    leadId: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
    notes?: string | null;
    reason?: string | null;
  }) {
    await this.db.insert(leadStatusHistory).values({
      organizationId: this.organizationId,
      leadId: input.leadId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      changedBy: input.changedBy,
      notes: input.notes ?? null,
      reason: (input.reason as never) ?? null,
    });
  }

  async statusHistory(leadId: string) {
    return this.db
      .select({
        id: leadStatusHistory.id,
        leadId: leadStatusHistory.leadId,
        fromStatus: leadStatusHistory.fromStatus,
        toStatus: leadStatusHistory.toStatus,
        changedAt: leadStatusHistory.changedAt,
        notes: leadStatusHistory.notes,
        reason: leadStatusHistory.reason,
        changedByName: users.fullName,
      })
      .from(leadStatusHistory)
      .leftJoin(users, eq(leadStatusHistory.changedBy, users.id))
      .where(
        and(
          eq(leadStatusHistory.organizationId, this.organizationId),
          eq(leadStatusHistory.leadId, leadId),
        ),
      )
      .orderBy(desc(leadStatusHistory.changedAt));
  }

  async insertAssignment(input: {
    leadId: string;
    assignedTo: string | null;
    assignedBy: string;
    strategy: string;
    previousOwnerId?: string | null;
    reason?: string | null;
  }) {
    await this.db.insert(leadAssignments).values({
      organizationId: this.organizationId,
      leadId: input.leadId,
      assignedTo: input.assignedTo,
      previousOwnerId: input.previousOwnerId ?? null,
      assignedBy: input.assignedBy,
      strategy: input.strategy,
      reason: input.reason ?? null,
    });
  }

  /** Export rows — same filters, no pagination (bounded by caller). */
  async exportRows(
    params: Omit<LeadListParams, "pagination">,
    limit: number,
  ) {
    const where = this.buildWhere({
      search: params.search,
      filters: params.filters,
    });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    return this.db
      .select({
        leadNumber: leads.leadNumber,
        firstName: leads.firstName,
        lastName: leads.lastName,
        fullName: leads.fullName,
        email: leads.email,
        phone: leads.phone,
        companyName: leads.companyName,
        industry: leads.industry,
        geography: leads.geography,
        source: leads.source,
        status: leads.status,
        ownerName: users.fullName,
        budget: leads.budget,
        expectedClosingDate: leads.expectedClosingDate,
        interestedProduct: leads.interestedProduct,
        aiScore: leads.aiScore,
        qualificationStatus: leads.qualificationStatus,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .leftJoin(users, eq(leads.ownerId, users.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(limit);
  }
}
