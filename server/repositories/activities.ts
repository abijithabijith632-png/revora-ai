import { and, asc, desc, eq, or, ilike, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import { activities, users } from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { ActivityFilter } from "@/lib/operations/schemas";

export type ActivitySortColumn = "occurredAt" | "createdAt";

const SORT_COLUMNS: Record<ActivitySortColumn, PgColumn> = {
  occurredAt: activities.occurredAt,
  createdAt: activities.createdAt,
};

export interface ActivityRow {
  id: string;
  type: string;
  subject: string | null;
  notes: string | null;
  metadata: unknown;
  leadId: string | null;
  clientId: string | null;
  contactId: string | null;
  opportunityId: string | null;
  performedByName: string | null;
  occurredAt: Date;
  createdAt: Date;
}

/**
 * Unified, polymorphic activity repository. Every CRM interaction (calls,
 * emails, meetings, notes, proposals, follow-ups, tasks, status changes) is
 * written here so client/opportunity timelines share a single source of truth.
 */
export class ActivityRepository extends TenantRepository {
  private baseWhere(): SQL {
    return eq(activities.organizationId, this.organizationId);
  }

  private buildWhere(input: {
    search?: string;
    filters?: ActivityFilter;
    entityType?: "lead" | "client" | "contact" | "opportunity";
    entityId?: string;
  }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.entityType && input.entityId) {
      const col = {
        lead: activities.leadId,
        client: activities.clientId,
        contact: activities.contactId,
        opportunity: activities.opportunityId,
      }[input.entityType];
      if (col) conditions.push(eq(col, input.entityId));
    }

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(activities.subject, term),
          ilike(activities.notes, term),
        )!,
      );
    }

    const f = input.filters;
    if (f?.type) conditions.push(eq(activities.type, f.type));
    if (f?.leadId) conditions.push(eq(activities.leadId, f.leadId));
    if (f?.clientId) conditions.push(eq(activities.clientId, f.clientId));
    if (f?.contactId) conditions.push(eq(activities.contactId, f.contactId));
    if (f?.opportunityId) conditions.push(eq(activities.opportunityId, f.opportunityId));

    return and(...conditions)!;
  }

  private select() {
    return {
      id: activities.id,
      type: activities.type,
      subject: activities.subject,
      notes: activities.notes,
      metadata: activities.metadata,
      leadId: activities.leadId,
      clientId: activities.clientId,
      contactId: activities.contactId,
      opportunityId: activities.opportunityId,
      performedByName: users.fullName,
      occurredAt: activities.occurredAt,
      createdAt: activities.createdAt,
    };
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<ActivitySortColumn>;
    search?: string;
    filters?: ActivityFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select(this.select())
      .from(activities)
      .leftJoin(users, eq(activities.performedBy, users.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  /** Timeline for a single client/opportunity/lead/contact. */
  async listTimeline(
    entityType: "lead" | "client" | "contact" | "opportunity",
    entityId: string,
    limit = 100,
  ) {
    const where = this.buildWhere({ entityType, entityId });
    return this.db
      .select(this.select())
      .from(activities)
      .leftJoin(users, eq(activities.performedBy, users.id))
      .where(where)
      .orderBy(desc(activities.occurredAt))
      .limit(limit);
  }

  async findById(id: string): Promise<ActivityRow | null> {
    const [row] = await this.db
      .select(this.select())
      .from(activities)
      .leftJoin(users, eq(activities.performedBy, users.id))
      .where(and(eq(activities.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async findIdByOrg(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, id), this.baseWhere()))
      .limit(1);
    return row?.id ?? null;
  }

  async create(input: {
    type: string;
    subject?: string | null;
    notes?: string | null;
    metadata?: unknown;
    leadId?: string | null;
    clientId?: string | null;
    contactId?: string | null;
    opportunityId?: string | null;
    performedBy?: string | null;
    occurredAt?: Date | null;
  }) {
    const [row] = await this.db
      .insert(activities)
      .values({
        organizationId: this.organizationId,
        type: input.type as never,
        subject: input.subject ?? null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? null,
        leadId: input.leadId ?? null,
        clientId: input.clientId ?? null,
        contactId: input.contactId ?? null,
        opportunityId: input.opportunityId ?? null,
        performedBy: input.performedBy ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      type: NonNullable<typeof activities.$inferInsert.type>;
      subject: string | null;
      notes: string | null;
      metadata: unknown;
      leadId: string | null;
      clientId: string | null;
      contactId: string | null;
      opportunityId: string | null;
      occurredAt: Date;
    }>,
  ) {
    const [row] = await this.db
      .update(activities)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(activities.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  async archive(id: string) {
    await this.db
      .delete(activities)
      .where(and(eq(activities.id, id), this.baseWhere()));
    return { id };
  }
}
