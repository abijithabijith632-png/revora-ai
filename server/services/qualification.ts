import { eq } from "drizzle-orm";
import { BaseService } from "./base";
import { QualificationRepository } from "@/server/repositories/qualification";
import { LeadRepository } from "@/server/repositories/leads";
import { db } from "@/db";
import {
  leads,
  leadQualifications,
  leadStatusHistory,
} from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { canTransition } from "@/lib/leads/lifecycle";
import type { CreateQualificationInput, LeadStatus } from "@/lib/leads/schemas";
import type { QualificationOutcome } from "@/lib/leads/qualification";

/**
 * Qualification business logic. Validates assessor + tenant, enforces the
 * QUALIFIED transition rule (assessment required), writes assessment history,
 * and applies the permitted lifecycle transition transactionally.
 */

export class QualificationService extends BaseService {
  private readonly repo: QualificationRepository;
  private readonly leadRepo: LeadRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new QualificationRepository(organizationId);
    this.leadRepo = new LeadRepository(organizationId);
  }

  async getForLead(leadId: string) {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new NotFoundError("Lead not found.");

    const history = await this.repo.findByLeadId(leadId);
    const latest = history[0] ?? null;
    const outcome = latest?.result ?? "pending";

    return { outcome, latest, history };
  }

  /**
   * Create a qualification assessment and optionally apply the permitted
   * lifecycle transition (transactionally).
   */
  async assess(
    actor: { userId: string },
    leadId: string,
    input: CreateQualificationInput,
  ) {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new NotFoundError("Lead not found.");

    // `unqualified` outcome requires a reason.
    if (input.outcome === "unqualified" && !input.reason) {
      throw new ValidationError(
        "A disqualification reason is required when the outcome is unqualified.",
        { reason: "Required." },
      );
    }

    const result: QualificationOutcome =
      input.outcome === "partially_qualified"
        ? "partially_qualified"
        : input.outcome;

    // Outcome → lifecycle transition mapping.
    const targetStatus: LeadStatus | null =
      result === "qualified"
        ? "qualified"
        : result === "unqualified"
          ? "unqualified"
          : null;

    if (
      input.applyTransition &&
      targetStatus &&
      !canTransition(lead.status as LeadStatus, targetStatus)
    ) {
      throw new ForbiddenError("That lifecycle transition is not allowed.");
    }

    // Guard: entering QUALIFIED requires a completed QUALIFIED assessment.
    if (
      input.applyTransition &&
      targetStatus === "qualified" &&
      result !== "qualified"
    ) {
      throw new ConflictError(
        "Qualification is required before marking this lead as Qualified.",
      );
    }

    // Transactional: assessment + optional transition + history.
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(leadQualifications)
        .values({
          organizationId: this.repo.orgId,
          leadId,
          requirementClarity: input.requirementClarity,
          budgetAvailability: input.budgetAvailability,
          purchaseTimeline: input.purchaseTimeline,
          decisionMaker: input.decisionMaker,
          companyScale: input.companyScale,
          productFit: input.productFit,
          conversionProbability: input.conversionProbability,
          decisionMakerName: input.decisionMakerName ?? null,
          decisionMakerDesignation: input.decisionMakerDesignation ?? null,
          result,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          qualifiedBy: actor.userId,
        })
        .returning();

      if (input.applyTransition && targetStatus) {
        await tx
          .update(leads)
          .set({
            status: targetStatus,
            qualificationStatus: result,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, leadId));

        await tx.insert(leadStatusHistory).values({
          organizationId: this.repo.orgId,
          leadId,
          fromStatus: lead.status as LeadStatus,
          toStatus: targetStatus,
          changedBy: actor.userId,
          notes: input.notes ?? null,
          reason: input.reason ?? null,
        });
      } else {
        // Persist latest outcome on the lead without changing lifecycle.
        await tx
          .update(leads)
          .set({ qualificationStatus: result, updatedAt: new Date() })
          .where(eq(leads.id, leadId));
      }

      return row;
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "approve",
      entityType: "lead_qualification",
      entityId: created.id,
      metadata: {
        leadId,
        outcome: result,
        transitionedTo: targetStatus ?? null,
      },
    });

    return this.getForLead(leadId);
  }
}
