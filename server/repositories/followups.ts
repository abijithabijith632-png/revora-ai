import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import {
  followups,
  users,
  clients,
  opportunities,
} from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { FollowupFilter } from "@/lib/operations/schemas";

export type FollowupSortColumn = "scheduledAt" | "priority" | "createdAt";

const SORT_COLUMNS: Record<FollowupSortColumn, PgColumn> = {
  scheduledAt: followups.scheduledAt,
  priority: followups.priority,
  createdAt: followups.createdAt,
};

export interface FollowupRow {
  id: string;
  leadId: string | null;
  clientId: string | null;
  clientName: string | null;
  contactId: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  channel: string;
  scheduledAt: Date;
  priority: string;
  status: string;
  actionDescription: string | null;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export class FollowupRepository extends TenantRepository {
  private baseWhere(): SQL {
    return eq(followups.organizationId, this.organizationId);
  }

  private buildWhere(input: {
    search?: string;
    filters?: FollowupFilter;
  }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(followups.actionDescription, term),
          ilike(followups.notes, term),
        )!,
      );
    }

    const f = input.filters;
    if (f?.status) conditions.push(eq(followups.status, f.status));
    if (f?.channel) conditions.push(eq(followups.channel, f.channel));
    if (f?.clientId) conditions.push(eq(followups.clientId, f.clientId));
    if (f?.opportunityId) conditions.push(eq(followups.opportunityId, f.opportunityId));
    if (f?.assignedTo) conditions.push(eq(followups.assignedTo, f.assignedTo));

    return and(...conditions)!;
  }

  private select() {
    return {
      id: followups.id,
      leadId: followups.leadId,
      clientId: followups.clientId,
      clientName: clients.companyName,
      contactId: followups.contactId,
      opportunityId: followups.opportunityId,
      opportunityName: opportunities.name,
      assignedTo: followups.assignedTo,
      assigneeName: users.fullName,
      channel: followups.channel,
      scheduledAt: followups.scheduledAt,
      priority: followups.priority,
      status: followups.status,
      actionDescription: followups.actionDescription,
      notes: followups.notes,
      completedAt: followups.completedAt,
      createdAt: followups.createdAt,
    };
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<FollowupSortColumn>;
    search?: string;
    filters?: FollowupFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select(this.select())
      .from(followups)
      .leftJoin(users, eq(followups.assignedTo, users.id))
      .leftJoin(clients, eq(followups.clientId, clients.id))
      .leftJoin(opportunities, eq(followups.opportunityId, opportunities.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(followups)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findById(id: string): Promise<FollowupRow | null> {
    const [row] = await this.db
      .select(this.select())
      .from(followups)
      .leftJoin(users, eq(followups.assignedTo, users.id))
      .leftJoin(clients, eq(followups.clientId, clients.id))
      .leftJoin(opportunities, eq(followups.opportunityId, opportunities.id))
      .where(and(eq(followups.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    leadId?: string | null;
    clientId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
    assignedTo?: string | null;
    channel: string;
    scheduledAt: Date;
    priority: string;
    status: string;
    actionDescription?: string | null;
    notes?: string | null;
  }) {
    const [row] = await this.db
      .insert(followups)
      .values({
        organizationId: this.organizationId,
        leadId: input.leadId ?? null,
        clientId: input.clientId ?? null,
        contactId: input.contactId ?? null,
        opportunityId: input.opportunityId ?? null,
        assignedTo: input.assignedTo ?? null,
        channel: input.channel as never,
        scheduledAt: input.scheduledAt,
        priority: input.priority as never,
        status: input.status as never,
        actionDescription: input.actionDescription ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      leadId: string | null;
      clientId: string | null;
      contactId: string | null;
      opportunityId: string | null;
      assignedTo: string | null;
      channel: NonNullable<typeof followups.$inferInsert.channel>;
      scheduledAt: Date;
      priority: NonNullable<typeof followups.$inferInsert.priority>;
      status: NonNullable<typeof followups.$inferInsert.status>;
      actionDescription: string | null;
      notes: string | null;
      completedAt: Date | null;
    }>,
  ) {
    const [row] = await this.db
      .update(followups)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(followups.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  /** Reminders: today's, upcoming (next 7 days), and overdue touchpoints. */
  async reminders(userId: string) {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [todayRows, upcomingRows, overdueRows] = await Promise.all([
      this.db
        .select(this.select())
        .from(followups)
        .leftJoin(users, eq(followups.assignedTo, users.id))
        .leftJoin(clients, eq(followups.clientId, clients.id))
        .leftJoin(opportunities, eq(followups.opportunityId, opportunities.id))
        .where(
          and(
            this.baseWhere(),
            eq(followups.assignedTo, userId),
            eq(followups.status, "pending"),
            sql`${followups.scheduledAt} >= ${today} AND ${followups.scheduledAt} < ${tomorrow}`,
          ),
        )
        .orderBy(asc(followups.scheduledAt)),
      this.db
        .select(this.select())
        .from(followups)
        .leftJoin(users, eq(followups.assignedTo, users.id))
        .leftJoin(clients, eq(followups.clientId, clients.id))
        .leftJoin(opportunities, eq(followups.opportunityId, opportunities.id))
        .where(
          and(
            this.baseWhere(),
            eq(followups.assignedTo, userId),
            eq(followups.status, "pending"),
            sql`${followups.scheduledAt} >= ${tomorrow} AND ${followups.scheduledAt} < ${nextWeek}`,
          ),
        )
        .orderBy(asc(followups.scheduledAt)),
      this.db
        .select(this.select())
        .from(followups)
        .leftJoin(users, eq(followups.assignedTo, users.id))
        .leftJoin(clients, eq(followups.clientId, clients.id))
        .leftJoin(opportunities, eq(followups.opportunityId, opportunities.id))
        .where(
          and(
            this.baseWhere(),
            eq(followups.assignedTo, userId),
            eq(followups.status, "pending"),
            sql`${followups.scheduledAt} < ${now}`,
          ),
        )
        .orderBy(asc(followups.scheduledAt)),
    ]);

    return {
      today: todayRows,
      upcoming: upcomingRows,
      overdue: overdueRows,
    };
  }
}
