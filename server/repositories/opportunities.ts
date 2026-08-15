import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import {
  opportunities,
  pipelineStages,
  opportunityStageHistory,
  clients,
  users,
} from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { OpportunityFilter } from "@/lib/opportunities/schemas";

export type OpportunitySortColumn =
  | "name"
  | "createdAt"
  | "amount"
  | "probability"
  | "expectedCloseDate";

const SORT_COLUMNS: Record<OpportunitySortColumn, PgColumn> = {
  name: opportunities.name,
  createdAt: opportunities.createdAt,
  amount: opportunities.amount,
  probability: opportunities.probability,
  expectedCloseDate: opportunities.expectedCloseDate,
};

export interface OpportunityListRow {
  id: string;
  opportunityNumber: string;
  name: string;
  clientId: string;
  clientName: string;
  ownerName: string | null;
  stageKey: string;
  stageName: string;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class OpportunityRepository extends TenantRepository {
  private baseWhere(): SQL {
    return and(
      eq(opportunities.organizationId, this.organizationId),
      eq(opportunities.isDeleted, false),
    )!;
  }

  private buildWhere(input: {
    search?: string;
    filters?: OpportunityFilter;
  }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(opportunities.name, term),
          ilike(opportunities.opportunityNumber, term),
          ilike(opportunities.productService, term),
          sql`${opportunities.clientId} IN (
            SELECT c2.id FROM clients c2
            WHERE c2.organization_id = ${this.organizationId}::uuid
              AND c2.is_deleted = false
              AND c2.company_name ILIKE ${term}
          )`,
        )!,
      );
    }

    const f = input.filters;
    if (f?.stageKey) {
      conditions.push(
        sql`${opportunities.stageId} IN (
          SELECT ps.id FROM pipeline_stages ps
          WHERE ps.organization_id = ${this.organizationId}::uuid
            AND ps.key = ${f.stageKey}
        )`,
      );
    }
    if (f?.clientId) conditions.push(eq(opportunities.clientId, f.clientId));
    if (f?.ownerId) conditions.push(eq(opportunities.ownerId, f.ownerId));

    return and(...conditions)!;
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<OpportunitySortColumn>;
    search?: string;
    filters?: OpportunityFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select({
        id: opportunities.id,
        opportunityNumber: opportunities.opportunityNumber,
        name: opportunities.name,
        clientId: opportunities.clientId,
        clientName: clients.companyName,
        ownerName: users.fullName,
        stageKey: sql<string>`coalesce(${pipelineStages.key}, 'new')`,
        stageName: sql<string>`coalesce(${pipelineStages.name}, 'New')`,
        amount: opportunities.amount,
        probability: opportunities.probability,
        expectedCloseDate: opportunities.expectedCloseDate,
        source: opportunities.source,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .innerJoin(clients, eq(opportunities.clientId, clients.id))
      .leftJoin(users, eq(opportunities.ownerId, users.id))
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async listStages() {
    return this.db
      .select({
        id: pipelineStages.id,
        key: pipelineStages.key,
        name: pipelineStages.name,
        orderIndex: pipelineStages.orderIndex,
        probability: pipelineStages.probability,
        isTerminal: pipelineStages.isTerminal,
      })
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.organizationId, this.organizationId),
          eq(pipelineStages.isActive, true),
        ),
      )
      .orderBy(asc(pipelineStages.orderIndex));
  }

  async findStageIdByKey(key: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: pipelineStages.id })
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.organizationId, this.organizationId),
          eq(pipelineStages.key, key),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: opportunities.id,
        opportunityNumber: opportunities.opportunityNumber,
        name: opportunities.name,
        description: opportunities.description,
        clientId: opportunities.clientId,
        clientName: clients.companyName,
        ownerId: opportunities.ownerId,
        ownerName: users.fullName,
        stageId: opportunities.stageId,
        stageKey: pipelineStages.key,
        stageName: pipelineStages.name,
        amount: opportunities.amount,
        currency: opportunities.currency,
        probability: opportunities.probability,
        source: opportunities.source,
        productService: opportunities.productService,
        expectedCloseDate: opportunities.expectedCloseDate,
        closedAt: opportunities.closedAt,
        closedReason: opportunities.closedReason,
        notes: opportunities.notes,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .innerJoin(clients, eq(opportunities.clientId, clients.id))
      .leftJoin(users, eq(opportunities.ownerId, users.id))
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(and(eq(opportunities.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async findIdByOrg(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, id),
          eq(opportunities.organizationId, this.organizationId),
          eq(opportunities.isDeleted, false),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async create(input: {
    opportunityNumber: string;
    name: string;
    clientId: string;
    ownerId?: string | null;
    stageId: string;
    amount?: number | null;
    currency?: string;
    probability?: number | null;
    expectedCloseDate?: Date | null;
    source?: string | null;
    productService?: string | null;
    description?: string | null;
    notes?: string | null;
  }) {
    const [row] = await this.db
      .insert(opportunities)
      .values({
        organizationId: this.organizationId,
        ...input,
        isDeleted: false,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      clientId: string;
      ownerId: string | null;
      stageId: string | null;
      amount: number | null;
      probability: number | null;
      expectedCloseDate: Date | null;
      source: string | null;
      productService: string | null;
      description: string | null;
      notes: string | null;
      closedAt: Date | null;
      closedReason: string | null;
    }>,
  ) {
    const [row] = await this.db
      .update(opportunities)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(opportunities.id, id),
          eq(opportunities.organizationId, this.organizationId),
        ),
      )
      .returning();
    return row;
  }

  async archive(id: string) {
    const [row] = await this.db
      .update(opportunities)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(opportunities.id, id),
          eq(opportunities.organizationId, this.organizationId),
        ),
      )
      .returning();
    return row;
  }

  async insertStageHistory(input: {
    opportunityId: string;
    previousStageId: string | null;
    newStageId: string;
    previousProbability: number | null;
    newProbability: number | null;
    changedBy: string;
    reason?: string | null;
  }) {
    await this.db.insert(opportunityStageHistory).values({
      organizationId: this.organizationId,
      opportunityId: input.opportunityId,
      previousStageId: input.previousStageId,
      newStageId: input.newStageId,
      previousProbability: input.previousProbability,
      newProbability: input.newProbability,
      changedBy: input.changedBy,
      reason: input.reason ?? null,
    });
  }

  async stageHistory(opportunityId: string) {
    return this.db
      .select({
        id: opportunityStageHistory.id,
        previousStageId: opportunityStageHistory.previousStageId,
        newStageId: opportunityStageHistory.newStageId,
        previousStageName: sql<string | null>`ps_prev.name`,
        newStageName: sql<string | null>`ps_new.name`,
        previousProbability: opportunityStageHistory.previousProbability,
        newProbability: opportunityStageHistory.newProbability,
        changedByName: users.fullName,
        changedAt: opportunityStageHistory.changedAt,
        reason: opportunityStageHistory.reason,
      })
      .from(opportunityStageHistory)
      .leftJoin(
        sql`pipeline_stages AS ps_prev`,
        eq(opportunityStageHistory.previousStageId, sql`ps_prev.id`),
      )
      .leftJoin(
        sql`pipeline_stages AS ps_new`,
        eq(opportunityStageHistory.newStageId, sql`ps_new.id`),
      )
      .leftJoin(users, eq(opportunityStageHistory.changedBy, users.id))
      .where(
        and(
          eq(opportunityStageHistory.organizationId, this.organizationId),
          eq(opportunityStageHistory.opportunityId, opportunityId),
        ),
      )
      .orderBy(desc(opportunityStageHistory.changedAt));
  }

  /** Pipeline summary: total/weighted/won/lost + per-stage distribution. */
  async pipelineSummary() {
    const [totals] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        totalValue: sql<number>`coalesce(sum(${opportunities.amount}), 0)::int`,
        weightedValue: sql<number>`coalesce(sum(${opportunities.amount} * ${opportunities.probability} / 100.0), 0)::numeric`,
        wonValue: sql<number>`coalesce(sum(${opportunities.amount}) filter (where ${pipelineStages}.key = 'won'), 0)::int`,
        lostValue: sql<number>`coalesce(sum(${opportunities.amount}) filter (where ${pipelineStages}.key = 'lost'), 0)::int`,
      })
      .from(opportunities)
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(this.baseWhere());

    const distribution = await this.db
      .select({
        stageKey: pipelineStages.key,
        stageName: pipelineStages.name,
        count: sql<number>`count(${opportunities.id})::int`,
        totalValue: sql<number>`coalesce(sum(${opportunities.amount}), 0)::int`,
        weightedValue: sql<number>`coalesce(sum(${opportunities.amount} * ${opportunities.probability} / 100.0), 0)::numeric`,
      })
      .from(pipelineStages)
      .leftJoin(
        opportunities,
        and(
          eq(opportunities.stageId, pipelineStages.id),
          eq(opportunities.organizationId, this.organizationId),
          eq(opportunities.isDeleted, false),
        ),
      )
      .where(
        and(
          eq(pipelineStages.organizationId, this.organizationId),
          eq(pipelineStages.isActive, true),
        ),
      )
      .groupBy(pipelineStages.key, pipelineStages.name, pipelineStages.orderIndex)
      .orderBy(asc(pipelineStages.orderIndex));

    return { totals, distribution };
  }

  async exportRows(
    params: { sort: Sort<OpportunitySortColumn>; search?: string; filters?: OpportunityFilter },
    limit: number,
  ) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    return this.db
      .select({
        opportunityNumber: opportunities.opportunityNumber,
        name: opportunities.name,
        clientName: clients.companyName,
        ownerName: users.fullName,
        stageName: pipelineStages.name,
        amount: opportunities.amount,
        probability: opportunities.probability,
        expectedCloseDate: opportunities.expectedCloseDate,
        source: opportunities.source,
        productService: opportunities.productService,
        createdAt: opportunities.createdAt,
      })
      .from(opportunities)
      .innerJoin(clients, eq(opportunities.clientId, clients.id))
      .leftJoin(users, eq(opportunities.ownerId, users.id))
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(limit);
  }
}
