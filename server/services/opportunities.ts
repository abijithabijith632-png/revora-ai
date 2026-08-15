import { eq, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { OpportunityRepository } from "@/server/repositories/opportunities";
import { ClientRepository } from "@/server/repositories/clients";
import { db } from "@/db";
import { opportunities, users } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { canTransition, stageProbability, type PipelineStageKey } from "@/lib/opportunities/pipeline";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateOpportunityInput,
  OpportunityFilter,
  OpportunityStageInput,
  UpdateOpportunityInput,
} from "@/lib/opportunities/schemas";

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

export class OpportunityService extends BaseService {
  private readonly repo: OpportunityRepository;
  private readonly clientRepo: ClientRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new OpportunityRepository(organizationId);
    this.clientRepo = new ClientRepository(organizationId);
  }

  private async nextOpportunityNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `OPP-${year}-`;
    const [row] = await db
      .select({ max: sql<string>`max(opportunity_number)` })
      .from(opportunities)
      .where(
        sql`${opportunities.organizationId} = ${this.repo.orgId} AND opportunity_number LIKE ${`${prefix}%`}`,
      );
    const max = row?.max ?? null;
    const last = max ? Number(max.slice(prefix.length)) : 0;
    return `${prefix}${String(last + 1).padStart(3, "0")}`;
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: OpportunityFilter;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.list({
      pagination: input.pagination,
      sort: sort as Sort<"createdAt">,
      search: input.search,
      filters: input.filters,
    });
  }

  async listStages() {
    return this.repo.listStages();
  }

  async pipelineSummary() {
    return this.repo.pipelineSummary();
  }

  async getById(id: string) {
    const opp = await this.repo.findById(id);
    if (!opp) throw new NotFoundError("Opportunity not found.");
    const history = await this.repo.stageHistory(id);
    return { ...opp, history };
  }

  private async validateClient(clientId: string) {
    const exists = await this.clientRepo.findClientIdByOrg(clientId);
    if (!exists) throw new ValidationError("Client must belong to this organization.");
  }

  private async validateOwner(ownerId?: string | null) {
    if (!ownerId) return;
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(
        sql`${users.id} = ${ownerId} AND ${users.organizationId} = ${this.repo.orgId} AND ${users.isDeleted} = false`,
      )
      .limit(1);
    if (!user) throw new ValidationError("Owner must belong to this organization.");
    if (user.status !== "active") throw new ValidationError("Owner must be an active user.");
  }

  async create(actor: { userId: string }, input: CreateOpportunityInput) {
    await this.validateClient(input.clientId);
    await this.validateOwner(input.ownerId);

    const stageId = await this.repo.findStageIdByKey(input.stageKey);
    if (!stageId) throw new ValidationError("Invalid pipeline stage.");

    const opportunityNumber = await this.nextOpportunityNumber();
    const probability = input.probability ?? stageProbability(input.stageKey);

    const opp = await this.repo.create({
      opportunityNumber,
      name: input.name.trim(),
      clientId: input.clientId,
      ownerId: input.ownerId ?? null,
      stageId,
      amount: input.amount ?? null,
      probability,
      expectedCloseDate: input.expectedCloseDate
        ? new Date(input.expectedCloseDate)
        : null,
      source: input.source ?? null,
      productService: input.productService ?? null,
      description: input.description ?? null,
      notes: input.notes ?? null,
    });

    await this.repo.insertStageHistory({
      opportunityId: opp.id,
      previousStageId: null,
      newStageId: stageId,
      previousProbability: null,
      newProbability: probability,
      changedBy: actor.userId,
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "opportunity",
      entityId: opp.id,
      metadata: { opportunityNumber },
    });

    return opp;
  }

  async update(actor: { userId: string }, id: string, input: UpdateOpportunityInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Opportunity not found.");

    if (input.clientId && input.clientId !== existing.clientId) {
      await this.validateClient(input.clientId);
    }
    if (input.ownerId !== undefined) {
      await this.validateOwner(input.ownerId);
    }

    let stageId: string | null = existing.stageId;
    if (input.stageKey && input.stageKey !== existing.stageKey) {
      const nextStageId = await this.repo.findStageIdByKey(input.stageKey);
      if (!nextStageId) throw new ValidationError("Invalid pipeline stage.");
      if (!canTransition(existing.stageKey as PipelineStageKey, input.stageKey)) {
        throw new ForbiddenError("That pipeline transition is not allowed.");
      }
      stageId = nextStageId;
    }

    const patch = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      stageId,
      amount: input.amount !== undefined ? input.amount : existing.amount,
      probability:
        input.probability !== undefined ? input.probability : existing.probability,
      expectedCloseDate:
        input.expectedCloseDate !== undefined
          ? input.expectedCloseDate
            ? new Date(input.expectedCloseDate)
            : null
          : existing.expectedCloseDate,
      source: input.source !== undefined ? input.source : existing.source,
      productService:
        input.productService !== undefined
          ? input.productService
          : existing.productService,
      description:
        input.description !== undefined ? input.description : existing.description,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    const updated = await this.repo.update(id, patch);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "opportunity",
      entityId: id,
    });

    return updated;
  }

  /** Server-validated stage transition (Kanban drag-and-drop + modal). */
  async changeStage(actor: { userId: string }, id: string, input: OpportunityStageInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Opportunity not found.");

    if (input.stageKey === existing.stageKey) return existing;

    if (!canTransition(existing.stageKey as PipelineStageKey, input.stageKey)) {
      throw new ForbiddenError("That pipeline transition is not allowed.");
    }

    if (input.stageKey === "lost" && !input.reason) {
      throw new ValidationError("A loss reason is required when moving to Lost.");
    }

    const newStageId = await this.repo.findStageIdByKey(input.stageKey);
    if (!newStageId) throw new ValidationError("Invalid pipeline stage.");

    const newProbability =
      input.probability ?? stageProbability(input.stageKey);

    await db.transaction(async (tx) => {
      await tx
        .update(opportunities)
        .set({
          stageId: newStageId,
          probability: newProbability,
          ...(input.stageKey === "won"
            ? { closedAt: new Date(), closedReason: null }
            : {}),
          ...(input.stageKey === "lost"
            ? { closedAt: new Date(), closedReason: input.reason ?? input.notes ?? null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(opportunities.id, id));

      await this.repo.insertStageHistory({
        opportunityId: id,
        previousStageId: existing.stageId,
        newStageId,
        previousProbability: existing.probability,
        newProbability,
        changedBy: actor.userId,
        reason: input.reason ?? input.notes ?? null,
      });
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "opportunity",
      entityId: id,
      metadata: {
        from: existing.stageKey,
        to: input.stageKey,
        previousProbability: existing.probability,
        newProbability,
      },
    });

    return this.repo.findById(id);
  }

  async archive(actor: { userId: string }, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Opportunity not found.");

    await this.repo.archive(id);

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "delete",
      entityType: "opportunity",
      entityId: id,
    });

    return { id };
  }

  async exportRows(params: {
    sort?: Sort<string>;
    search?: string;
    filters?: OpportunityFilter;
    limit: number;
  }) {
    const sort: Sort<"createdAt"> =
      (params.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.exportRows(
      { sort: sort as Sort<"createdAt">, search: params.search, filters: params.filters },
      params.limit,
    );
  }
}
