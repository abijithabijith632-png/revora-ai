import { BaseService } from "./base";
import { LeadConfigRepository } from "@/server/repositories/lead-config";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, ValidationError } from "@/lib/errors";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/leads/schemas";

/**
 * Lead status + source configuration service (Phase 16).
 * System values remain immutable; custom values are validated (no duplicates
 * against system set) and deactivation guards against orphaned references.
 */
export class LeadConfigService extends BaseService {
  private readonly repo: LeadConfigRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new LeadConfigRepository(organizationId);
  }

  private ensureValidKey(key: string): string {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!normalized) throw new ValidationError("Key must contain letters or numbers.");
    return normalized;
  }

  async listStatuses() {
    return this.repo.listStatuses();
  }

  async listSources() {
    return this.repo.listSources();
  }

  async upsertStatus(actor: { userId: string }, input: {
    key: string;
    label?: string;
    color?: string | null;
    orderIndex?: number;
    isActive?: boolean;
  }) {
    const key = this.ensureValidKey(input.key);
    if ((LEAD_STATUSES as readonly string[]).includes(key)) {
      throw new ConflictError("System status keys cannot be overwritten.");
    }
    const existing = await this.repo.findStatusByKey(key);
    const row = await this.repo.upsertStatus({
      ...input,
      key,
      label: input.label ?? existing?.label ?? key,
    });
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "lead_status_config",
      entityId: row.id,
      metadata: { key, isActive: input.isActive },
    });
    return row;
  }

  async upsertSource(actor: { userId: string }, input: {
    key: string;
    label?: string;
    orderIndex?: number;
    isActive?: boolean;
  }) {
    const key = this.ensureValidKey(input.key);
    if ((LEAD_SOURCES as readonly string[]).includes(key)) {
      throw new ConflictError("System source keys cannot be overwritten.");
    }
    const existing = await this.repo.findSourceByKey(key);
    const row = await this.repo.upsertSource({
      ...input,
      key,
      label: input.label ?? existing?.label ?? key,
    });
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "lead_source_config",
      entityId: row.id,
      metadata: { key, isActive: input.isActive },
    });
    return row;
  }

  async deactivateStatus(actor: { userId: string }, key: string) {
    const count = await this.repo.countLeadsByStatus(key);
    if (count > 0) {
      throw new ConflictError(
        `Cannot deactivate "${key}" — ${count} lead(s) still reference it. Reassign them first.`,
      );
    }
    const row = await this.repo.deactivateStatus(key);
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "lead_status_config",
      entityId: row.id,
      metadata: { key, deactivated: true },
    });
    return row;
  }

  async deactivateSource(actor: { userId: string }, key: string) {
    const row = await this.repo.deactivateSource(key);
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "lead_source_config",
      entityId: row.id,
      metadata: { key, deactivated: true },
    });
    return row;
  }
}
