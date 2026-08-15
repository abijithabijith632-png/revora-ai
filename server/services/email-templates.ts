import { BaseService } from "./base";
import { EmailTemplateRepository } from "@/server/repositories/email-templates";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError } from "@/lib/errors";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateEmailTemplateInput,
  EmailTemplateFilter,
  UpdateEmailTemplateInput,
} from "@/lib/commercial/schemas";

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

/**
 * Organization-scoped reusable email templates with duplicate + archive
 * support. No external email provider required for template management.
 */
export class EmailTemplateService extends BaseService {
  private readonly repo: EmailTemplateRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new EmailTemplateRepository(organizationId);
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: EmailTemplateFilter;
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
    const template = await this.repo.findById(id);
    if (!template) throw new NotFoundError("Email template not found.");
    return template;
  }

  async create(actor: { userId: string }, input: CreateEmailTemplateInput) {
    const template = await this.repo.create({
      category: input.category,
      name: input.name,
      subject: input.subject,
      body: input.body,
      variables: input.variables ?? null,
      createdBy: actor.userId,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "email_template",
      entityId: template.id,
    });

    return template;
  }

  async update(actor: { userId: string }, id: string, input: UpdateEmailTemplateInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Email template not found.");

    const updated = await this.repo.update(id, {
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.subject !== undefined ? { subject: input.subject.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.variables !== undefined ? { variables: input.variables } : {}),
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "email_template",
      entityId: id,
    });

    return updated;
  }

  async duplicate(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Email template not found.");

    const copy = await this.repo.duplicate(id, actor.userId);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "email_template",
      entityId: copy?.id,
      metadata: { duplicatedFrom: id },
    });

    return copy;
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Email template not found.");

    const updated = await this.repo.update(id, { isArchived: true });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "email_template",
      entityId: id,
    });

    return updated;
  }
}
