import { and, eq, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { OpportunityRepository } from "@/server/repositories/opportunities";
import { ClientRepository } from "@/server/repositories/clients";
import { db } from "@/db";
import { opportunities, opportunityStageHistory, users } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { canTransition, stageProbability, type PipelineStageKey } from "@/lib/opportunities/pipeline";
import { PipelineConfigService } from "./pipeline-config";
import { NotificationService } from "./notifications";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateOpportunityInput,
  OpportunityFilter,
  OpportunityStageInput,
  UpdateOpportunityInput,
} from "@/lib/opportunities/schemas";
import { STAGE_KEYS } from "@/lib/opportunities/schemas";

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

  private async resolveStage(stageKey: string) {
    // Organizations created before stage provisioning have zero rows while
    // the UI offers canonical stages — seed defaults on demand so valid
    // stage keys always resolve. Never touches configured orgs.
    await new PipelineConfigService(this.repo.orgId).ensureDefaultStages();
    const stage = await this.repo.findActiveStageByKey(stageKey);
    if (!stage) throw new ValidationError("Invalid or inactive pipeline stage.");
    return stage;
  }

  async create(actor: { userId: string }, input: CreateOpportunityInput) {
    await this.validateClient(input.clientId);
    await this.validateOwner(input.ownerId);

    const stage = await this.resolveStage(input.stageKey);
    const stageId = stage.id;

    const opportunityNumber = await this.nextOpportunityNumber();
    const probability = input.probability ?? stage.probability ?? stageProbability(input.stageKey);

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
      const nextStage = await this.resolveStage(input.stageKey);
      const currentStage = existing.stageKey
        ? await this.repo.findActiveStageByKey(existing.stageKey)
        : null;
      const currentIsCanonical = STAGE_KEYS.includes(existing.stageKey as (typeof STAGE_KEYS)[number]);
      const nextIsCanonical = STAGE_KEYS.includes(input.stageKey as (typeof STAGE_KEYS)[number]);
      const allowed = currentIsCanonical && nextIsCanonical
        ? canTransition(existing.stageKey as PipelineStageKey, input.stageKey as PipelineStageKey)
        : Boolean(currentStage && !currentStage.isTerminal && nextStage.orderIndex > currentStage.orderIndex);
      if (!allowed) {
        throw new ForbiddenError("That pipeline transition is not allowed.");
      }
      stageId = nextStage.id;
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

    if (input.stageKey && input.stageKey !== existing.stageKey) {
      const notifyOwner =
        (input.ownerId !== undefined ? input.ownerId : existing.ownerId) as
          | string
          | null;
      if (notifyOwner) {
        try {
          await new NotificationService(this.repo.orgId).notify({
            userId: notifyOwner,
            type: "stage_changed",
            title: `Opportunity moved to ${input.stageKey}`,
            message: `"${existing.name}" moved from ${existing.stageKey} to ${input.stageKey}.`,
            entityType: "opportunity",
            entityId: id,
          });
        } catch {
          // Notifications must never break opportunity updates.
        }
      }
    }

    return updated;
  }

  /** Server-validated stage transition (Kanban drag-and-drop + modal). */
  async changeStage(actor: { userId: string }, id: string, input: OpportunityStageInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Opportunity not found.");

    // Normalize a missing stage (deleted stage row) to the canonical start,
    // matching the list query's coalesce(key, 'new') so orphaned rows can
    // still move forward instead of failing every transition with 403.
    const fromKey = (existing.stageKey ?? "new") as PipelineStageKey;

    if (input.stageKey === fromKey && existing.stageKey !== null) return existing;

    const resolvedStage = await this.resolveStage(input.stageKey);
    const currentStage = existing.stageKey
      ? await this.repo.findActiveStageByKey(existing.stageKey)
      : null;
    const fromIsCanonical = STAGE_KEYS.includes(fromKey as (typeof STAGE_KEYS)[number]);
    const toIsCanonical = STAGE_KEYS.includes(input.stageKey as (typeof STAGE_KEYS)[number]);
    const allowed = fromIsCanonical && toIsCanonical
      ? canTransition(fromKey, input.stageKey as PipelineStageKey)
      : Boolean(currentStage && !currentStage.isTerminal && resolvedStage.orderIndex > currentStage.orderIndex);
    if (!allowed) {
      throw new ForbiddenError("That pipeline transition is not allowed.");
    }

    if (input.stageKey === "lost" && !input.reason) {
      throw new ValidationError("A loss reason is required when moving to Lost.");
    }

    const newStageId = resolvedStage.id;

    // Verify the resolved stage still belongs to this organization. The
    // lookup is already org-scoped, but re-check explicitly so a cross-tenant
    // id can never be persisted even if the lookup is ever relaxed.
    const targetStage = await this.repo.findStageById(newStageId);
    if (!targetStage) throw new ValidationError("Invalid pipeline stage.");

    const newProbability = input.probability ?? resolvedStage.probability ?? stageProbability(input.stageKey as PipelineStageKey);

    // Atomic, tenant-scoped transition: both the opportunity update and the
    // history insert run on the same transaction handle. Using the global
    // pool inside the callback would need a second connection (deadlock with
    // max:1 on Vercel) and would leave the two writes non-atomic.
    const updatedRows = await db.transaction(async (tx) => {
      const [updated] = await tx
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
        .where(
          and(
            eq(opportunities.id, id),
            eq(opportunities.organizationId, this.repo.orgId),
            eq(opportunities.isDeleted, false),
          ),
        )
        .returning({ id: opportunities.id });

      if (!updated) throw new NotFoundError("Opportunity not found.");

      await tx.insert(opportunityStageHistory).values({
        organizationId: this.repo.orgId,
        opportunityId: id,
        previousStageId: existing.stageId,
        newStageId,
        previousProbability: existing.probability,
        newProbability,
        changedBy: actor.userId,
        reason: input.reason ?? input.notes ?? null,
      });

      return updated;
    });
    void updatedRows;

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

    if (existing.ownerId) {
      try {
        await new NotificationService(this.repo.orgId).notify({
          userId: existing.ownerId,
          type: "stage_changed",
          title: `Opportunity moved to ${input.stageKey}`,
          message: `"${existing.name}" moved from ${fromKey} to ${input.stageKey}.`,
          entityType: "opportunity",
          entityId: id,
        });
      } catch {
        // Notifications must never break stage changes.
      }
    }

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
