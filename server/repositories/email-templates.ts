import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import { emailTemplates } from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { EmailTemplateFilter } from "@/lib/commercial/schemas";

export type EmailTemplateSortColumn = "name" | "createdAt";

const SORT_COLUMNS: Record<EmailTemplateSortColumn, PgColumn> = {
  name: emailTemplates.name,
  createdAt: emailTemplates.createdAt,
};

export class EmailTemplateRepository extends TenantRepository {
  private baseWhere(): SQL {
    return eq(emailTemplates.organizationId, this.organizationId);
  }

  private buildWhere(input: { search?: string; filters?: EmailTemplateFilter }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(ilike(emailTemplates.name, term), ilike(emailTemplates.subject, term))!,
      );
    }

    const f = input.filters;
    if (f?.category) conditions.push(eq(emailTemplates.category, f.category));
    if (f?.archived === "true") conditions.push(eq(emailTemplates.isArchived, true));
    if (f?.archived === "false") conditions.push(eq(emailTemplates.isArchived, false));

    return and(...conditions)!;
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<EmailTemplateSortColumn>;
    search?: string;
    filters?: EmailTemplateFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select()
      .from(emailTemplates)
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailTemplates)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    category: string;
    name: string;
    subject: string;
    body: string;
    variables?: unknown;
    createdBy?: string | null;
  }) {
    const [row] = await this.db
      .insert(emailTemplates)
      .values({
        organizationId: this.organizationId,
        category: input.category,
        name: input.name,
        subject: input.subject,
        body: input.body,
        variables: input.variables ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      category: string;
      name: string;
      subject: string;
      body: string;
      variables: unknown;
      isArchived: boolean;
    }>,
  ) {
    const [row] = await this.db
      .update(emailTemplates)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  async duplicate(id: string, createdBy?: string | null) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const [row] = await this.db
      .insert(emailTemplates)
      .values({
        organizationId: this.organizationId,
        category: existing.category,
        name: `${existing.name} (Copy)`,
        subject: existing.subject,
        body: existing.body,
        variables: existing.variables,
        createdBy: createdBy ?? null,
      })
      .returning();
    return row;
  }
}
