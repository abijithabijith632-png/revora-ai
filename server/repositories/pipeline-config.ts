import { and, asc, eq } from "drizzle-orm";
import { TenantRepository } from "./base";
import { pipelineStages, opportunities } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Pipeline stage configuration repository (Phase 16).
 * Extends the existing pipelineStages table (Phase 12); probability editing
 * is validated in the service layer.
 */

export class PipelineConfigRepository extends TenantRepository {
  async list() {
    return this.db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, this.organizationId))
      .orderBy(asc(pipelineStages.orderIndex));
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.id, id),
          eq(pipelineStages.organizationId, this.organizationId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    name: string;
    key: string;
    orderIndex: number;
    probability?: number | null;
    isActive?: boolean;
    isTerminal?: boolean;
  }) {
    const [row] = await this.db
      .insert(pipelineStages)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: {
      name?: string;
      orderIndex?: number;
      probability?: number | null;
      isActive?: boolean;
    },
  ) {
    const [row] = await this.db
      .update(pipelineStages)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(pipelineStages.id, id),
          eq(pipelineStages.organizationId, this.organizationId),
        ),
      )
      .returning();
    return row;
  }

  /** Count opportunities currently sitting in a stage (safe-guard). */
  async countOpportunitiesInStage(stageId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.organizationId, this.organizationId),
          eq(opportunities.stageId, stageId),
          eq(opportunities.isDeleted, false),
        ),
      );
    return row?.count ?? 0;
  }
}
