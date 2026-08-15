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
import { clients, contacts, users } from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { ClientFilter, ContactFilter } from "@/lib/clients/schemas";
import type { ClientStatus } from "@/lib/clients/presentation";

/**
 * Client + contact data access — tenant-scoped. Never issue a query without
 * the organization equality guard.
 */

export type ClientSortColumn =
  | "companyName"
  | "createdAt"
  | "customerSince"
  | "status"
  | "accountManagerId";

export type ContactSortColumn =
  | "firstName"
  | "designation"
  | "createdAt"
  | "clientId";

const CLIENT_SORT_COLUMNS: Record<ClientSortColumn, PgColumn> = {
  companyName: clients.companyName,
  createdAt: clients.createdAt,
  customerSince: clients.customerSince,
  status: clients.status,
  accountManagerId: clients.accountManagerId,
};

const CONTACT_SORT_COLUMNS: Record<ContactSortColumn, PgColumn> = {
  firstName: contacts.firstName,
  designation: contacts.designation,
  createdAt: contacts.createdAt,
  clientId: contacts.clientId,
};

export interface ClientListRow {
  id: string;
  clientNumber: string;
  companyName: string;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  status: string;
  vipFlag: boolean;
  customerSince: Date | null;
  accountManagerId: string | null;
  accountManagerName: string | null;
  primaryContactName: string | null;
  createdAt: Date;
}

export interface ContactRow {
  id: string;
  clientId: string;
  clientName: string;
  firstName: string;
  lastName: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  preferredChannel: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

export class ClientRepository extends TenantRepository {
  private clientBaseWhere(): SQL {
    return and(
      eq(clients.organizationId, this.organizationId),
      eq(clients.isDeleted, false),
    )!;
  }

  private buildClientWhere(input: {
    search?: string;
    filters?: ClientFilter;
  }): SQL {
    const conditions: SQL[] = [this.clientBaseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(clients.clientNumber, term),
          ilike(clients.companyName, term),
          ilike(clients.website, term),
          ilike(clients.industry, term),
          sql`${clients.id} IN (
            SELECT c2.client_id FROM contacts c2
            WHERE c2.organization_id = ${this.organizationId}::uuid
              AND c2.is_deleted = false
              AND (
                c2.first_name ILIKE ${term} OR
                c2.last_name ILIKE ${term} OR
                c2.email ILIKE ${term}
              )
          )`,
        )!,
      );
    }

    const f = input.filters;
    if (f?.status) conditions.push(eq(clients.status, f.status));
    if (f?.industry) conditions.push(eq(clients.industry, f.industry));
    if (f?.accountManagerId) {
      conditions.push(eq(clients.accountManagerId, f.accountManagerId));
    }

    return and(...conditions)!;
  }

  async listClients(params: {
    pagination: Pagination;
    sort: Sort<ClientSortColumn>;
    search?: string;
    filters?: ClientFilter;
  }) {
    const where = this.buildClientWhere({
      search: params.search,
      filters: params.filters,
    });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select({
        id: clients.id,
        clientNumber: clients.clientNumber,
        companyName: clients.companyName,
        industry: clients.industry,
        companySize: clients.companySize,
        website: clients.website,
        status: clients.status,
        vipFlag: clients.vipFlag,
        customerSince: clients.customerSince,
        accountManagerId: clients.accountManagerId,
        accountManagerName: users.fullName,
        primaryContactName: sql<string | null>`(
          SELECT concat(c.first_name, ' ', c.last_name)
          FROM contacts c
          WHERE c.id = ${clients.primaryContactId}
            AND c.is_deleted = false
        )`,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .leftJoin(users, eq(clients.accountManagerId, users.id))
      .where(where)
      .orderBy(orderFn(CLIENT_SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async countActive(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(this.clientBaseWhere());
    return row?.count ?? 0;
  }

  async summaryByStatus() {
    const rows = await this.db
      .select({
        status: clients.status,
        count: sql<number>`count(*)::int`,
      })
      .from(clients)
      .where(this.clientBaseWhere())
      .groupBy(clients.status);
    return rows;
  }

  async findClientById(id: string) {
    const [row] = await this.db
      .select({
        id: clients.id,
        clientNumber: clients.clientNumber,
        sourceLeadId: clients.sourceLeadId,
        companyName: clients.companyName,
        industry: clients.industry,
        companySize: clients.companySize,
        corporateInfo: clients.corporateInfo,
        address: clients.address,
        billingAddress: clients.billingAddress,
        website: clients.website,
        primaryContactId: clients.primaryContactId,
        accountManagerId: clients.accountManagerId,
        customerSince: clients.customerSince,
        status: clients.status,
        vipFlag: clients.vipFlag,
        notes: clients.notes,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        accountManagerName: users.fullName,
      })
      .from(clients)
      .leftJoin(users, eq(clients.accountManagerId, users.id))
      .where(and(eq(clients.id, id), this.clientBaseWhere()))
      .limit(1);
    return row ?? null;
  }

  async findClientIdByOrg(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.id, id),
          eq(clients.organizationId, this.organizationId),
          eq(clients.isDeleted, false),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async createClient(input: {
    clientNumber: string;
    sourceLeadId?: string | null;
    companyName: string;
    industry?: string | null;
    companySize?: string | null;
    corporateInfo?: string | null;
    address?: string | null;
    billingAddress?: string | null;
    website?: string | null;
    accountManagerId?: string | null;
    customerSince?: Date | null;
    status: ClientStatus;
    vipFlag?: boolean;
    notes?: string | null;
  }) {
    const [row] = await this.db
      .insert(clients)
      .values({
        organizationId: this.organizationId,
        ...input,
        isDeleted: false,
      })
      .returning();
    return row;
  }

  async updateClient(
    id: string,
    input: Partial<{
      companyName: string;
      industry: string | null;
      companySize: string | null;
      corporateInfo: string | null;
      address: string | null;
      billingAddress: string | null;
      website: string | null;
      accountManagerId: string | null;
      customerSince: Date | null;
      status: ClientStatus;
      vipFlag: boolean;
      notes: string | null;
      primaryContactId: string | null;
    }>,
  ) {
    const [row] = await this.db
      .update(clients)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(clients.id, id), eq(clients.organizationId, this.organizationId)),
      )
      .returning();
    return row;
  }

  async archiveClient(id: string) {
    const [row] = await this.db
      .update(clients)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(clients.id, id), eq(clients.organizationId, this.organizationId)),
      )
      .returning();
    return row;
  }

  // ---------- Contacts ----------

  private contactBaseWhere(): SQL {
    return and(
      eq(contacts.organizationId, this.organizationId),
      eq(contacts.isDeleted, false),
    )!;
  }

  private buildContactWhere(input: {
    search?: string;
    filters?: ContactFilter;
    clientId?: string;
  }): SQL {
    const conditions: SQL[] = [this.contactBaseWhere()];

    if (input.clientId) conditions.push(eq(contacts.clientId, input.clientId));

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, term),
          ilike(contacts.lastName, term),
          ilike(contacts.email, term),
          ilike(contacts.phone, term),
          ilike(contacts.designation, term),
          sql`${contacts.clientId} IN (
            SELECT c2.id FROM clients c2
            WHERE c2.organization_id = ${this.organizationId}::uuid
              AND c2.is_deleted = false
              AND c2.company_name ILIKE ${term}
          )`,
        )!,
      );
    }

    const f = input.filters;
    if (f?.clientId) conditions.push(eq(contacts.clientId, f.clientId));
    if (f?.designation) conditions.push(eq(contacts.designation, f.designation));
    if (f?.preferredChannel) {
      conditions.push(eq(contacts.preferredChannel, f.preferredChannel));
    }
    if (f?.isPrimary) {
      conditions.push(eq(contacts.isPrimary, f.isPrimary === "true"));
    }

    return and(...conditions)!;
  }

  async listContacts(params: {
    pagination: Pagination;
    sort: Sort<ContactSortColumn>;
    search?: string;
    filters?: ContactFilter;
    clientId?: string;
  }) {
    const where = this.buildContactWhere({
      search: params.search,
      filters: params.filters,
      clientId: params.clientId,
    });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select({
        id: contacts.id,
        clientId: contacts.clientId,
        clientName: clients.companyName,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        designation: contacts.designation,
        email: contacts.email,
        phone: contacts.phone,
        linkedinUrl: contacts.linkedinUrl,
        preferredChannel: contacts.preferredChannel,
        isPrimary: contacts.isPrimary,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(clients, eq(contacts.clientId, clients.id))
      .where(where)
      .orderBy(orderFn(CONTACT_SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .innerJoin(clients, eq(contacts.clientId, clients.id))
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async listContactsByClient(clientId: string) {
    return this.db
      .select({
        id: contacts.id,
        clientId: contacts.clientId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        designation: contacts.designation,
        email: contacts.email,
        phone: contacts.phone,
        linkedinUrl: contacts.linkedinUrl,
        preferredChannel: contacts.preferredChannel,
        isPrimary: contacts.isPrimary,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, this.organizationId),
          eq(contacts.clientId, clientId),
          eq(contacts.isDeleted, false),
        ),
      )
      .orderBy(desc(contacts.isPrimary), asc(contacts.createdAt));
  }

  async findContactById(id: string) {
    const [row] = await this.db
      .select({
        id: contacts.id,
        clientId: contacts.clientId,
        clientName: clients.companyName,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        designation: contacts.designation,
        email: contacts.email,
        phone: contacts.phone,
        linkedinUrl: contacts.linkedinUrl,
        preferredChannel: contacts.preferredChannel,
        isPrimary: contacts.isPrimary,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(clients, eq(contacts.clientId, clients.id))
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.organizationId, this.organizationId),
          eq(contacts.isDeleted, false),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findContactIdByOrg(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.organizationId, this.organizationId),
          eq(contacts.isDeleted, false),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async createContact(input: {
    clientId: string;
    firstName: string;
    lastName?: string | null;
    designation?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    preferredChannel?: string | null;
    isPrimary?: boolean;
  }) {
    const [row] = await this.db
      .insert(contacts)
      .values({
        organizationId: this.organizationId,
        ...input,
        isDeleted: false,
      })
      .returning();
    return row;
  }

  async updateContact(
    id: string,
    input: Partial<{
      firstName: string;
      lastName: string | null;
      designation: string | null;
      email: string | null;
      phone: string | null;
      linkedinUrl: string | null;
      preferredChannel: string | null;
      isPrimary: boolean;
    }>,
  ) {
    const [row] = await this.db
      .update(contacts)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(contacts.id, id), eq(contacts.organizationId, this.organizationId)),
      )
      .returning();
    return row;
  }

  async clearPrimaryForClient(clientId: string) {
    await this.db
      .update(contacts)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(contacts.organizationId, this.organizationId),
          eq(contacts.clientId, clientId),
          eq(contacts.isPrimary, true),
        ),
      );
  }

  async archiveContact(id: string) {
    const [row] = await this.db
      .update(contacts)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(contacts.id, id), eq(contacts.organizationId, this.organizationId)),
      )
      .returning();
    return row;
  }

  /** Deterministic existing-client match for conversion. */
  async findExistingClientMatch(input: {
    companyName?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
  }): Promise<{ id: string; clientNumber: string; companyName: string } | null> {
    const conditions: SQL[] = [];
    if (input.companyName) {
      conditions.push(eq(clients.companyName, input.companyName));
    }
    if (input.website) {
      conditions.push(eq(clients.website, input.website));
    }
    if (conditions.length === 0) return null;

    const [row] = await this.db
      .select({
        id: clients.id,
        clientNumber: clients.clientNumber,
        companyName: clients.companyName,
      })
      .from(clients)
      .where(and(this.clientBaseWhere(), or(...conditions)))
      .limit(1);

    return row ?? null;
  }
}
