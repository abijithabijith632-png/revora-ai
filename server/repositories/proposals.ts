import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import {
  proposals,
  proposalEvents,
  opportunities,
  clients,
  users,
} from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { ProposalFilter } from "@/lib/commercial/schemas";

export type ProposalSortColumn = "createdAt" | "amount";

const SORT_COLUMNS: Record<ProposalSortColumn, PgColumn> = {
  createdAt: proposals.createdAt,
  amount: proposals.amount,
};

export interface ProposalRow {
  id: string;
  opportunityId: string;
  opportunityName: string;
  clientId: string | null;
  clientName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  title: string;
  amount: number | null;
  version: number;
  status: string;
  sentAt: Date | null;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  expiryDate: Date | null;
  cancelledAt: Date | null;
  viewCount: number;
  notes: string | null;
  createdAt: Date;
}

export class ProposalRepository extends TenantRepository {
  private baseWhere(): SQL {
    return eq(proposals.organizationId, this.organizationId);
  }

  private buildWhere(input: { search?: string; filters?: ProposalFilter }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(or(ilike(proposals.title, term), ilike(proposals.notes, term))!);
    }

    const f = input.filters;
    if (f?.status) conditions.push(eq(proposals.status, f.status));
    if (f?.opportunityId) conditions.push(eq(proposals.opportunityId, f.opportunityId));
    if (f?.clientId) conditions.push(eq(proposals.clientId, f.clientId));
    if (f?.ownerId) conditions.push(eq(proposals.ownerId, f.ownerId));

    return and(...conditions)!;
  }

  private select() {
    return {
      id: proposals.id,
      opportunityId: proposals.opportunityId,
      opportunityName: opportunities.name,
      clientId: proposals.clientId,
      clientName: clients.companyName,
      ownerId: proposals.ownerId,
      ownerName: users.fullName,
      title: proposals.title,
      amount: proposals.amount,
      version: proposals.version,
      status: proposals.status,
      sentAt: proposals.sentAt,
      viewedAt: proposals.viewedAt,
      acceptedAt: proposals.acceptedAt,
      rejectedAt: proposals.rejectedAt,
      expiryDate: proposals.expiryDate,
      cancelledAt: proposals.cancelledAt,
      viewCount: proposals.viewCount,
      notes: proposals.notes,
      createdAt: proposals.createdAt,
    };
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<ProposalSortColumn>;
    search?: string;
    filters?: ProposalFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select(this.select())
      .from(proposals)
      .innerJoin(opportunities, eq(proposals.opportunityId, opportunities.id))
      .leftJoin(clients, eq(proposals.clientId, clients.id))
      .leftJoin(users, eq(proposals.ownerId, users.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposals)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findById(id: string): Promise<ProposalRow | null> {
    const [row] = await this.db
      .select(this.select())
      .from(proposals)
      .innerJoin(opportunities, eq(proposals.opportunityId, opportunities.id))
      .leftJoin(clients, eq(proposals.clientId, clients.id))
      .leftJoin(users, eq(proposals.ownerId, users.id))
      .where(and(eq(proposals.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    opportunityId: string;
    clientId?: string | null;
    ownerId?: string | null;
    title: string;
    amount?: number | null;
    status: string;
    expiryDate?: Date | null;
    notes?: string | null;
    createdBy?: string | null;
  }) {
    const [row] = await this.db
      .insert(proposals)
      .values({
        organizationId: this.organizationId,
        opportunityId: input.opportunityId,
        clientId: input.clientId ?? null,
        ownerId: input.ownerId ?? null,
        title: input.title,
        amount: input.amount ?? null,
        status: input.status as never,
        expiryDate: input.expiryDate ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      opportunityId: string;
      clientId: string | null;
      ownerId: string | null;
      title: string;
      amount: number | null;
      status: NonNullable<typeof proposals.$inferInsert.status>;
      sentAt: Date | null;
      viewedAt: Date | null;
      acceptedAt: Date | null;
      rejectedAt: Date | null;
      expiryDate: Date | null;
      cancelledAt: Date | null;
      viewCount: number;
      notes: string | null;
    }>,
  ) {
    const [row] = await this.db
      .update(proposals)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(proposals.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  async insertEvent(input: {
    proposalId: string;
    fromStatus?: string | null;
    toStatus: string;
    changedBy?: string | null;
    notes?: string | null;
  }) {
    const [row] = await this.db
      .insert(proposalEvents)
      .values({
        organizationId: this.organizationId,
        proposalId: input.proposalId,
        fromStatus: (input.fromStatus as never) ?? null,
        toStatus: input.toStatus as never,
        changedBy: input.changedBy ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row;
  }

  async listEvents(proposalId: string) {
    return this.db
      .select({
        id: proposalEvents.id,
        fromStatus: proposalEvents.fromStatus,
        toStatus: proposalEvents.toStatus,
        changedByName: users.fullName,
        notes: proposalEvents.notes,
        occurredAt: proposalEvents.occurredAt,
      })
      .from(proposalEvents)
      .leftJoin(users, eq(proposalEvents.changedBy, users.id))
      .where(eq(proposalEvents.proposalId, proposalId))
      .orderBy(desc(proposalEvents.occurredAt));
  }
}
