import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import { documents, clients, opportunities, users } from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { DocumentFilter } from "@/lib/commercial/schemas";

export type DocumentSortColumn = "name" | "createdAt";

const SORT_COLUMNS: Record<DocumentSortColumn, PgColumn> = {
  name: documents.name,
  createdAt: documents.createdAt,
};

export class DocumentRepository extends TenantRepository {
  private baseWhere(): SQL {
    return and(
      eq(documents.organizationId, this.organizationId),
      eq(documents.isDeleted, false),
    )!;
  }

  private buildWhere(input: { search?: string; filters?: DocumentFilter }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(or(ilike(documents.name, term), ilike(documents.fileReference, term))!);
    }

    const f = input.filters;
    if (f?.documentType) conditions.push(eq(documents.documentType, f.documentType));
    if (f?.clientId) conditions.push(eq(documents.clientId, f.clientId));
    if (f?.opportunityId) conditions.push(eq(documents.opportunityId, f.opportunityId));
    if (f?.status) conditions.push(eq(documents.status, f.status));

    return and(...conditions)!;
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<DocumentSortColumn>;
    search?: string;
    filters?: DocumentFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select({
        id: documents.id,
        name: documents.name,
        documentType: documents.documentType,
        fileReference: documents.fileReference,
        sizeBytes: documents.sizeBytes,
        mimeType: documents.mimeType,
        uploadedByName: users.fullName,
        clientId: documents.clientId,
        clientName: clients.companyName,
        opportunityId: documents.opportunityId,
        opportunityName: opportunities.name,
        version: documents.version,
        status: documents.status,
        accessPermissions: documents.accessPermissions,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .leftJoin(clients, eq(documents.clientId, clients.id))
      .leftJoin(opportunities, eq(documents.opportunityId, opportunities.id))
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: documents.id,
        name: documents.name,
        documentType: documents.documentType,
        fileReference: documents.fileReference,
        sizeBytes: documents.sizeBytes,
        mimeType: documents.mimeType,
        uploadedByName: users.fullName,
        clientId: documents.clientId,
        clientName: clients.companyName,
        opportunityId: documents.opportunityId,
        opportunityName: opportunities.name,
        version: documents.version,
        status: documents.status,
        accessPermissions: documents.accessPermissions,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .leftJoin(clients, eq(documents.clientId, clients.id))
      .leftJoin(opportunities, eq(documents.opportunityId, opportunities.id))
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(and(eq(documents.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    name: string;
    documentType: string;
    fileReference?: string | null;
    sizeBytes?: number | null;
    mimeType?: string | null;
    uploadedBy?: string | null;
    leadId?: string | null;
    clientId?: string | null;
    opportunityId?: string | null;
    version: number;
    status: string;
    accessPermissions?: unknown;
  }) {
    const [row] = await this.db
      .insert(documents)
      .values({
        organizationId: this.organizationId,
        name: input.name,
        documentType: input.documentType as never,
        fileReference: input.fileReference ?? null,
        sizeBytes: input.sizeBytes ?? null,
        mimeType: input.mimeType ?? null,
        uploadedBy: input.uploadedBy ?? null,
        leadId: input.leadId ?? null,
        clientId: input.clientId ?? null,
        opportunityId: input.opportunityId ?? null,
        version: input.version,
        status: input.status,
        accessPermissions: input.accessPermissions ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      documentType: NonNullable<typeof documents.$inferInsert.documentType>;
      fileReference: string | null;
      sizeBytes: number | null;
      mimeType: string | null;
      clientId: string | null;
      opportunityId: string | null;
      version: number;
      status: string;
      accessPermissions: unknown;
    }>,
  ) {
    const [row] = await this.db
      .update(documents)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(documents.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  async archive(id: string) {
    const [row] = await this.db
      .update(documents)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(documents.id, id), this.baseWhere()))
      .returning();
    return row;
  }
}
