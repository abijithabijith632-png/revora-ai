import { BaseService } from "./base";
import { DocumentRepository } from "@/server/repositories/documents";
import { ActivityService } from "./activities";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError } from "@/lib/errors";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateDocumentInput,
  DocumentFilter,
  UpdateDocumentInput,
} from "@/lib/commercial/schemas";

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

/**
 * Centralized client document repository. Stores metadata + access governance;
 * the file bytes themselves are handled by a clean storage abstraction
 * (server/services/storage.ts) so no sensitive storage path is exposed.
 */
export class DocumentService extends BaseService {
  private readonly repo: DocumentRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new DocumentRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: DocumentFilter;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.list({
      pagination: input.pagination,
      sort,
      search: input.search,
      filters: input.filters,
    });
  }

  async getById(id: string) {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundError("Document not found.");
    return doc;
  }

  async create(actor: { userId: string }, input: CreateDocumentInput) {
    const doc = await this.repo.create({
      name: input.name,
      documentType: input.documentType,
      fileReference: input.fileReference ?? null,
      sizeBytes: input.sizeBytes ?? null,
      mimeType: input.mimeType ?? null,
      uploadedBy: actor.userId,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      opportunityId: input.opportunityId ?? null,
      version: input.version ?? 1,
      status: input.status ?? "active",
      accessPermissions: input.accessPermissions ?? null,
    });

    await new ActivityService(this.repo.orgId).recordActivity({
      type: "note",
      subject: `Document uploaded: ${input.name}`,
      clientId: input.clientId ?? null,
      opportunityId: input.opportunityId ?? null,
      performedBy: actor.userId,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "document",
      entityId: doc.id,
    });

    return doc;
  }

  async update(actor: { userId: string }, id: string, input: UpdateDocumentInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Document not found.");

    const patch: Parameters<typeof this.repo.update>[1] = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.documentType !== undefined
        ? { documentType: input.documentType }
        : {}),
      ...(input.version !== undefined ? { version: input.version } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      opportunityId:
        input.opportunityId !== undefined
          ? input.opportunityId
          : existing.opportunityId,
      fileReference:
        input.fileReference !== undefined
          ? input.fileReference
          : existing.fileReference,
      sizeBytes:
        input.sizeBytes !== undefined ? input.sizeBytes : existing.sizeBytes,
      mimeType: input.mimeType !== undefined ? input.mimeType : existing.mimeType,
      accessPermissions:
        input.accessPermissions !== undefined
          ? input.accessPermissions
          : existing.accessPermissions,
    };

    const updated = await this.repo.update(id, patch);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "document",
      entityId: id,
    });

    return updated;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Document not found.");

    await this.repo.archive(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "document",
      entityId: id,
    });

    return { id };
  }
}
