import { BaseService } from "./base";
import { OrganizationRepository } from "@/server/repositories/organizations";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError } from "@/lib/errors";

/**
 * Organization settings service (Phase 16).
 * All mutations are tenant-scoped and audited.
 */
export class OrganizationSettingsService extends BaseService {
  private readonly repo: OrganizationRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new OrganizationRepository(organizationId);
  }

  async getProfile() {
    const profile = await this.repo.getProfile();
    if (!profile) throw new NotFoundError("Organization not found.");
    const settings = await this.repo.getSettings();
    return { profile, settings };
  }

  async updateProfile(actor: { userId: string }, input: {
    name?: string;
    description?: string | null;
    website?: string | null;
    industry?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    timezone?: string;
    currency?: string;
  }) {
    const updated = await this.repo.updateProfile(input);
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "organization",
      entityId: this.repo.orgId,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  }

  async updateSettings(actor: { userId: string }, input: {
    timezone?: string;
    currency?: string;
    dateFormat?: string;
    notificationPreferences?: unknown;
    brandingPreferences?: unknown;
    aiPreferences?: unknown;
    integrationPreferences?: unknown;
  }) {
    const updated = await this.repo.updateSettings(input);
    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "organization_settings",
      entityId: updated.id,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  }

  async usage() {
    return this.repo.usage();
  }
}
