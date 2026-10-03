import { BaseService } from "./base";
import { PipelineConfigRepository } from "@/server/repositories/pipeline-config";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, ValidationError } from "@/lib/errors";
import { db } from "@/db";
import { pipelineStages } from "@/db/schema";
import { PIPELINE_STAGES, STAGE_BY_KEY } from "@/lib/opportunities/pipeline";
import type { PipelineSyncInput } from "@/lib/opportunities/schemas";

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

  /**
   * Provision the canonical stage set for organizations that have none
   * (e.g. created before stage provisioning existed). Never touches orgs
   * that already configured stages. Race-safe via the (org, key) unique
   * index. This keeps opportunity creation working without migrations.
   */
  async ensureDefaultStages(): Promise<{ seeded: boolean }> {
    const existing = await this.repo.list();
    if (existing.length > 0) return { seeded: false };
    await db
      .insert(pipelineStages)
      .values(
        PIPELINE_STAGES.map((s) => ({
          organizationId: this.repo.orgId,
          name: s.label,
          key: s.key,
          orderIndex: s.order,
          probability: s.probability,
          isActive: true,
          isTerminal: s.terminal,
        })),
      )
      .onConflictDoNothing();
    return { seeded: true };
  }

  /**
   * Replace the org's stage configuration in one call (the "+ New Pipeline"
   * flow). Existing stages are matched by key and updated; missing keys are
   * inserted; stages absent from the new set are deactivated — never
   * deleted — and only when no open opportunities reference them.
   */
  async syncStages(actor: { userId: string }, input: PipelineSyncInput) {
    const keys = input.stages.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      throw new ValidationError("Stage keys must be unique.");
    }
    const names = input.stages.map((s) => s.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      throw new ValidationError("Stage names must be unique.");
    }
    if (names.some((n) => n.length === 0)) {
      throw new ValidationError("Stage names cannot be empty.");
    }

    const existing = await this.repo.list();
    const byKey = new Map(existing.map((row) => [row.key, row]));
    let order = 1;
    for (const stage of input.stages) {
      const canonical = STAGE_BY_KEY.get(stage.key);
      const found = byKey.get(stage.key);
      if (found) {
        await this.repo.update(found.id, {
          name: stage.name.trim(),
          orderIndex: order,
          probability: stage.probability ?? canonical?.probability ?? null,
          isActive: true,
        });
      } else {
        await this.repo.create({
          name: stage.name.trim(),
          key: stage.key,
          orderIndex: order,
          probability: stage.probability ?? canonical?.probability ?? null,
          isActive: true,
          isTerminal: stage.isTerminal ?? canonical?.terminal ?? false,
        });
      }
      order += 1;
    }

    for (const row of existing) {
      if (keys.includes(row.key as (typeof keys)[number]) || !row.isActive) continue;
      const count = await this.repo.countOpportunitiesInStage(row.id);
      if (count > 0) {
        throw new ConflictError(
          `Cannot remove stage "${row.name}" — ${count} open opportunity(s) still reference it.`,
        );
      }
      await this.repo.update(row.id, { isActive: false });
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "pipeline",
      metadata: { name: input.name.trim(), stages: keys },
    });
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
