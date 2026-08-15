import { and, desc, eq } from "drizzle-orm";
import { TenantRepository } from "./base";
import { leadQualifications, users } from "@/db/schema";
import type { CreateQualificationInput } from "@/lib/leads/schemas";
import type { QualificationOutcome } from "@/lib/leads/qualification";

/**
 * Qualification data access — tenant-scoped through the lead's organization.
 */

export class QualificationRepository extends TenantRepository {
  async findByLeadId(leadId: string) {
    const rows = await this.db
      .select({
        id: leadQualifications.id,
        leadId: leadQualifications.leadId,
        requirementClarity: leadQualifications.requirementClarity,
        budgetAvailability: leadQualifications.budgetAvailability,
        purchaseTimeline: leadQualifications.purchaseTimeline,
        decisionMaker: leadQualifications.decisionMaker,
        companyScale: leadQualifications.companyScale,
        productFit: leadQualifications.productFit,
        conversionProbability: leadQualifications.conversionProbability,
        decisionMakerName: leadQualifications.decisionMakerName,
        decisionMakerDesignation: leadQualifications.decisionMakerDesignation,
        result: leadQualifications.result,
        reason: leadQualifications.reason,
        notes: leadQualifications.notes,
        qualifiedAt: leadQualifications.qualifiedAt,
        qualifiedByName: users.fullName,
      })
      .from(leadQualifications)
      .leftJoin(users, eq(leadQualifications.qualifiedBy, users.id))
      .where(
        and(
          eq(leadQualifications.organizationId, this.organizationId),
          eq(leadQualifications.leadId, leadId),
        ),
      )
      .orderBy(desc(leadQualifications.qualifiedAt));

    return rows;
  }

  async create(input: CreateQualificationInput & {
    leadId: string;
    qualifiedBy: string;
    result: QualificationOutcome;
  }) {
    const [row] = await this.db
      .insert(leadQualifications)
      .values({
        organizationId: this.organizationId,
        leadId: input.leadId,
        requirementClarity: input.requirementClarity,
        budgetAvailability: input.budgetAvailability,
        purchaseTimeline: input.purchaseTimeline,
        decisionMaker: input.decisionMaker,
        companyScale: input.companyScale,
        productFit: input.productFit,
        conversionProbability: input.conversionProbability,
        decisionMakerName: input.decisionMakerName ?? null,
        decisionMakerDesignation: input.decisionMakerDesignation ?? null,
        result: input.result,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        qualifiedBy: input.qualifiedBy,
      })
      .returning();
    return row;
  }
}
