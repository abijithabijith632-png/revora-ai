import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import { tasks, users, clients, opportunities } from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { TaskFilter } from "@/lib/operations/schemas";

export type TaskSortColumn = "dueDate" | "priority" | "createdAt";

const SORT_COLUMNS: Record<TaskSortColumn, PgColumn> = {
  dueDate: tasks.dueDate,
  priority: tasks.priority,
  createdAt: tasks.createdAt,
};

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdByName: string | null;
  dueDate: Date | null;
  priority: string;
  status: string;
  leadId: string | null;
  clientId: string | null;
  clientName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export class TaskRepository extends TenantRepository {
  private baseWhere(): SQL {
    return eq(tasks.organizationId, this.organizationId);
  }

  private buildWhere(input: {
    search?: string;
    filters?: TaskFilter;
  }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(or(ilike(tasks.title, term), ilike(tasks.description, term))!);
    }

    const f = input.filters;
    if (f?.status) conditions.push(eq(tasks.status, f.status));
    if (f?.priority) conditions.push(eq(tasks.priority, f.priority));
    if (f?.assignedTo) conditions.push(eq(tasks.assignedTo, f.assignedTo));
    if (f?.clientId) conditions.push(eq(tasks.clientId, f.clientId));
    if (f?.opportunityId) conditions.push(eq(tasks.opportunityId, f.opportunityId));

    return and(...conditions)!;
  }

  private select() {
    return {
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      assignedTo: tasks.assignedTo,
      assigneeName: users.fullName,
      createdByName: sql<string | null>`creator.full_name`,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      status: tasks.status,
      leadId: tasks.leadId,
      clientId: tasks.clientId,
      clientName: clients.companyName,
      opportunityId: tasks.opportunityId,
      opportunityName: opportunities.name,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
    };
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<TaskSortColumn>;
    search?: string;
    filters?: TaskFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select(this.select())
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(sql`users AS creator`, eq(tasks.createdBy, sql`creator.id`))
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .leftJoin(opportunities, eq(tasks.opportunityId, opportunities.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findById(id: string): Promise<TaskRow | null> {
    const [row] = await this.db
      .select(this.select())
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(sql`users AS creator`, eq(tasks.createdBy, sql`creator.id`))
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .leftJoin(opportunities, eq(tasks.opportunityId, opportunities.id))
      .where(and(eq(tasks.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    title: string;
    description?: string | null;
    assignedTo?: string | null;
    createdBy?: string | null;
    dueDate?: Date | null;
    priority: string;
    status: string;
    leadId?: string | null;
    clientId?: string | null;
    opportunityId?: string | null;
  }) {
    const [row] = await this.db
      .insert(tasks)
      .values({
        organizationId: this.organizationId,
        title: input.title,
        description: input.description ?? null,
        assignedTo: input.assignedTo ?? null,
        createdBy: input.createdBy ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority as never,
        status: input.status as never,
        leadId: input.leadId ?? null,
        clientId: input.clientId ?? null,
        opportunityId: input.opportunityId ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      assignedTo: string | null;
      dueDate: Date | null;
      priority: NonNullable<typeof tasks.$inferInsert.priority>;
      status: NonNullable<typeof tasks.$inferInsert.status>;
      leadId: string | null;
      clientId: string | null;
      opportunityId: string | null;
      completedAt: Date | null;
    }>,
  ) {
    const [row] = await this.db
      .update(tasks)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  async archive(id: string) {
    const [row] = await this.db
      .update(tasks)
      .set({ status: "cancelled" as never, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), this.baseWhere()))
      .returning();
    return row;
  }
}
