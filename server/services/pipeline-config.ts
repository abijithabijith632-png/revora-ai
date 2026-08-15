import { BaseService } from "./base";
import { PipelineConfigRepository } from "@/server/repositories/pipeline-config";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, ValidationError } from "@/lib/errors";

/**
 * Pipeline stage configuration service (Phase 16).
 * Probability is validated 0–100 server-side; deactivation guards against
 * stages that still hold open opportunities.
 */
export class PipelineConfigService extends BaseService {
  private readonly repo: PipelineConfigRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new PipelineConfigRepository(organizationId);
  }

  private validateProbability(p: number | null | undefined) {
    if (p == null) return;
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      throw new ValidationError("Probability must be an integer between 0 and 100.");
    }
  }

  async list() {
    return this.repo.list();
  }

  async create(actor: { userId: string }, input: {
    name: string;
    key: string;
    orderIndex: number;
    probability?: number | null;
    isActive?: boolean;
    isTerminal?: boolean;
  }) {
    this.validateProbability(input.probability);
    const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const row = await this.repo.create({ ...input, key });
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "pipeline_stage",
      entityId: row.id,
      metadata: { key },
    });
    return row;
  }

  async update(actor: { userId: string }, id: string, input: {
    name?: string;
    orderIndex?: number;
    probability?: number | null;
    isActive?: boolean;
  }) {
    this.validateProbability(input.probability);
    const existing = await this.repo.findById(id);
    if (!existing) throw new ValidationError("Stage not found.");

    if (input.isActive === false) {
      const count = await this.repo.countOpportunitiesInStage(id);
      if (count > 0) {
        throw new ConflictError(
          `Cannot deactivate stage — ${count} open opportunity(s) still reference it.`,
        );
      }
    }

    const row = await this.repo.update(id, input);
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "pipeline_stage",
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return row;
  }
}
