import { sql } from "drizzle-orm";
import { BaseService } from "./base";
import { ClientRepository } from "@/server/repositories/clients";
import { db } from "@/db";
import { clients, users } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  ClientFilter,
  CreateClientInput,
  UpdateClientInput,
} from "@/lib/clients/schemas";
import type { ClientStatus } from "@/lib/clients/presentation";

/**
 * Client business logic — CRUD, human-readable ID generation, account-manager
 * validation, status changes, and audit.
 */

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

export class ClientService extends BaseService {
  private readonly repo: ClientRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new ClientRepository(organizationId);
  }

  /** Format: CL-{year}-{seq}, per-tenant collision guard. */
  private async nextClientNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `CL-${year}-`;

    const [row] = await db
      .select({ max: sql<string>`max(client_number)` })
      .from(clients)
      .where(
        sql`${clients.organizationId} = ${this.repo.orgId} AND client_number LIKE ${`${prefix}%`}`,
      );

    const max = row?.max ?? null;
    const lastNumber = max ? Number(max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: ClientFilter;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.listClients({
      pagination: input.pagination,
      sort: sort as Sort<"createdAt">,
      search: input.search,
      filters: input.filters,
    });
  }

  async summary() {
    const [total, byStatus] = await Promise.all([
      this.repo.countActive(),
      this.repo.summaryByStatus(),
    ]);
    const statusCount: Record<string, number> = {};
    for (const s of byStatus) statusCount[s.status] = s.count;
    return { total, byStatus: statusCount };
  }

  async getById(id: string) {
    const client = await this.repo.findClientById(id);
    if (!client) throw new NotFoundError("Client not found.");
    const contacts = await this.repo.listContactsByClient(id);
    return { ...client, contacts };
  }

  private async validateAccountManager(accountManagerId?: string | null) {
    if (!accountManagerId) return;
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(
        sql`${users.id} = ${accountManagerId} AND ${users.organizationId} = ${this.repo.orgId} AND ${users.isDeleted} = false`,
      )
      .limit(1);
    if (!user) {
      throw new ValidationError("Account manager must belong to this organization.");
    }
    if (user.status !== "active") {
      throw new ValidationError("Account manager must be an active user.");
    }
  }

  async create(actor: { userId: string }, input: CreateClientInput) {
    await this.validateAccountManager(input.accountManagerId);

    const clientNumber = await this.nextClientNumber();
    const client = await this.repo.createClient({
      clientNumber,
      companyName: input.companyName,
      industry: input.industry ?? null,
      companySize: input.companySize ?? null,
      corporateInfo: input.corporateInfo ?? null,
      address: input.address ?? null,
      billingAddress: input.billingAddress ?? null,
      website: input.website ?? null,
      accountManagerId: input.accountManagerId ?? null,
      customerSince: input.customerSince ? new Date(input.customerSince) : null,
      status: input.status as ClientStatus,
      vipFlag: input.vipFlag,
      notes: input.notes ?? null,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "client",
      entityId: client.id,
      metadata: { clientNumber },
    });

    return client;
  }

  async update(actor: { userId: string }, id: string, input: UpdateClientInput) {
    const existing = await this.repo.findClientById(id);
    if (!existing) throw new NotFoundError("Client not found.");

    if (input.accountManagerId !== undefined) {
      await this.validateAccountManager(input.accountManagerId);
    }

    const patch = {
      ...(input.companyName !== undefined
        ? { companyName: input.companyName.trim() }
        : {}),
      industry: input.industry !== undefined ? input.industry : existing.industry,
      companySize:
        input.companySize !== undefined ? input.companySize : existing.companySize,
      corporateInfo:
        input.corporateInfo !== undefined
          ? input.corporateInfo
          : existing.corporateInfo,
      address: input.address !== undefined ? input.address : existing.address,
      billingAddress:
        input.billingAddress !== undefined
          ? input.billingAddress
          : existing.billingAddress,
      website: input.website !== undefined ? input.website : existing.website,
      accountManagerId:
        input.accountManagerId !== undefined
          ? input.accountManagerId
          : existing.accountManagerId,
      customerSince:
        input.customerSince !== undefined
          ? input.customerSince
            ? new Date(input.customerSince)
            : null
          : existing.customerSince,
      status: (input.status as ClientStatus) ?? (existing.status as ClientStatus),
      vipFlag: input.vipFlag ?? existing.vipFlag,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    const updated = await this.repo.updateClient(id, patch);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "client",
      entityId: id,
      metadata: { changed: Object.keys(patch) },
    });

    return updated;
  }

  async changeStatus(
    actor: { userId: string },
    id: string,
    status: ClientStatus,
  ) {
    const existing = await this.repo.findClientById(id);
    if (!existing) throw new NotFoundError("Client not found.");
    if (existing.status === status) return existing;

    const updated = await this.repo.updateClient(id, { status });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "client",
      entityId: id,
      metadata: { from: existing.status, to: status },
    });

    return updated;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findClientById(id);
    if (!existing) throw new NotFoundError("Client not found.");

    await this.repo.archiveClient(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "client",
      entityId: id,
    });

    return { id };
  }

  /** Export rows (org-scoped, filter-aware, bounded). */
  async exportRows(params: {
    sort?: Sort<string>;
    search?: string;
    filters?: ClientFilter;
    limit: number;
  }) {
    const sort: Sort<"createdAt"> =
      (params.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    const { rows } = await this.repo.listClients({
      pagination: { page: 1, pageSize: params.limit, offset: 0 },
      sort: sort as Sort<"createdAt">,
      search: params.search,
      filters: params.filters,
    });
    return rows;
  }
}
