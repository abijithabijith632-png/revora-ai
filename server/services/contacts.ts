import { eq } from "drizzle-orm";
import { BaseService } from "./base";
import { ClientRepository } from "@/server/repositories/clients";
import { db } from "@/db";
import { contacts, clients } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  ContactFilter,
  CreateContactInput,
  UpdateContactInput,
} from "@/lib/clients/schemas";

/**
 * Contact business logic — CRUD, transactional primary-contact swap, audit.
 */

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

export class ContactService extends BaseService {
  private readonly repo: ClientRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new ClientRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: ContactFilter;
    clientId?: string;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.listContacts({
      pagination: input.pagination,
      sort: sort as Sort<"createdAt">,
      search: input.search,
      filters: input.filters,
      clientId: input.clientId,
    });
  }

  async getById(id: string) {
    const contact = await this.repo.findContactById(id);
    if (!contact) throw new NotFoundError("Contact not found.");
    return contact;
  }

  private async ensureClientInOrg(clientId: string) {
    const clientIdInOrg = await this.repo.findClientIdByOrg(clientId);
    if (!clientIdInOrg) {
      throw new ValidationError("Client must belong to this organization.");
    }
  }

  async create(actor: { userId: string }, input: CreateContactInput) {
    await this.ensureClientInOrg(input.clientId);

    const created = await db.transaction(async (tx) => {
      if (input.isPrimary) {
        await tx
          .update(contacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            eq(contacts.clientId, input.clientId),
          );
      }

      const [row] = await tx
        .insert(contacts)
        .values({
          organizationId: this.repo.orgId,
          clientId: input.clientId,
          firstName: input.firstName.trim(),
          lastName: input.lastName ?? null,
          designation: input.designation ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          linkedinUrl: input.linkedinUrl ?? null,
          preferredChannel: input.preferredChannel ?? null,
          isPrimary: input.isPrimary,
          isDeleted: false,
        })
        .returning();

      if (input.isPrimary) {
        await tx
          .update(clients)
          .set({ primaryContactId: row.id, updatedAt: new Date() })
          .where(eq(clients.id, input.clientId));
      }

      return row;
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "contact",
      entityId: created.id,
      metadata: { clientId: input.clientId, isPrimary: input.isPrimary },
    });

    return created;
  }

  async update(actor: { userId: string }, id: string, input: UpdateContactInput) {
    const existing = await this.repo.findContactById(id);
    if (!existing) throw new NotFoundError("Contact not found.");

    if (input.clientId && input.clientId !== existing.clientId) {
      throw new ValidationError("A contact's client cannot be changed.");
    }

    const updated = await db.transaction(async (tx) => {
      if (input.isPrimary) {
        await tx
          .update(contacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(contacts.clientId, existing.clientId));
      }

      const [row] = await tx
        .update(contacts)
        .set({
          ...(input.firstName !== undefined
            ? { firstName: input.firstName.trim() }
            : {}),
          lastName: input.lastName !== undefined ? input.lastName : undefined,
          designation:
            input.designation !== undefined ? input.designation : undefined,
          email: input.email !== undefined ? input.email : undefined,
          phone: input.phone !== undefined ? input.phone : undefined,
          linkedinUrl:
            input.linkedinUrl !== undefined ? input.linkedinUrl : undefined,
          preferredChannel:
            input.preferredChannel !== undefined
              ? input.preferredChannel
              : undefined,
          isPrimary: input.isPrimary ?? existing.isPrimary,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id))
        .returning();

      if (input.isPrimary) {
        await tx
          .update(clients)
          .set({ primaryContactId: id, updatedAt: new Date() })
          .where(eq(clients.id, existing.clientId));
      } else if (input.isPrimary === false && existing.isPrimary) {
        // Primary was removed; clear the client's primary reference.
        await tx
          .update(clients)
          .set({ primaryContactId: null, updatedAt: new Date() })
          .where(eq(clients.id, existing.clientId));
      }

      return row;
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "contact",
      entityId: id,
      metadata: { clientId: existing.clientId },
    });

    return updated;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findContactById(id);
    if (!existing) throw new NotFoundError("Contact not found.");

    await db.transaction(async (tx) => {
      await tx
        .update(contacts)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(contacts.id, id));

      if (existing.isPrimary) {
        await tx
          .update(clients)
          .set({ primaryContactId: null, updatedAt: new Date() })
          .where(eq(clients.id, existing.clientId));
      }
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "contact",
      entityId: id,
      metadata: { clientId: existing.clientId },
    });

    return { id };
  }
}
