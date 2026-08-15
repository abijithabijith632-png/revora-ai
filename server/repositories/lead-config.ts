import { and, asc, eq, sql } from "drizzle-orm";
import { TenantRepository } from "./base";
import {
  leadStatusConfigs,
  leadSourceConfigs,
  leads,
} from "@/db/schema";

/**
 * Lead status + source configuration repository (Phase 16).
 * Tenant-configurable values are additive to the canonical system set.
 */

export class LeadConfigRepository extends TenantRepository {
  async listStatuses() {
    return this.db
      .select()
      .from(leadStatusConfigs)
      .where(eq(leadStatusConfigs.organizationId, this.organizationId))
      .orderBy(asc(leadStatusConfigs.orderIndex));
  }

  async listSources() {
    return this.db
      .select()
      .from(leadSourceConfigs)
      .where(eq(leadSourceConfigs.organizationId, this.organizationId))
      .orderBy(asc(leadSourceConfigs.orderIndex));
  }

  async findStatusByKey(key: string) {
    const [row] = await this.db
      .select()
      .from(leadStatusConfigs)
      .where(
        and(
          eq(leadStatusConfigs.organizationId, this.organizationId),
          eq(leadStatusConfigs.key, key),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findSourceByKey(key: string) {
    const [row] = await this.db
      .select()
      .from(leadSourceConfigs)
      .where(
        and(
          eq(leadSourceConfigs.organizationId, this.organizationId),
          eq(leadSourceConfigs.key, key),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertStatus(input: {
    key: string;
    label: string;
    color?: string | null;
    orderIndex?: number;
    isActive?: boolean;
    isSystem?: boolean;
  }) {
    const existing = await this.findStatusByKey(input.key);
    if (existing) {
      const [row] = await this.db
        .update(leadStatusConfigs)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(leadStatusConfigs.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(leadStatusConfigs)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }

  async upsertSource(input: {
    key: string;
    label: string;
    orderIndex?: number;
    isActive?: boolean;
    isSystem?: boolean;
  }) {
    const existing = await this.findSourceByKey(input.key);
    if (existing) {
      const [row] = await this.db
        .update(leadSourceConfigs)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(leadSourceConfigs.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(leadSourceConfigs)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }

  async deactivateStatus(key: string) {
    return this.upsertStatus({ key, label: key, isActive: false });
  }

  async deactivateSource(key: string) {
    return this.upsertSource({ key, label: key, isActive: false });
  }

  /** Count references to a status key across active leads (safe-guard). */
  async countLeadsByStatus(status: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sqlCount() })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, this.organizationId),
          eq(leads.status, status),
        ),
      );
    return row?.count ?? 0;
  }
}

function sqlCount() {
  return sql<number>`count(*)::int`;
}
