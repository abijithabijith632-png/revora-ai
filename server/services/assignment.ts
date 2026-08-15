import { eq } from "drizzle-orm";
import { BaseService } from "./base";
import { AssignmentRepository } from "@/server/repositories/assignment";
import { LeadRepository } from "@/server/repositories/leads";
import { db } from "@/db";
import { leads, leadAssignments } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Lead assignment business logic — 4 deterministic strategies + telemetry.
 * No AI, no external infra. Strategy resolution is explainable and auditable.
 */

export type AssignmentStrategy =
  | "manual"
  | "round_robin"
  | "territory"
  | "skill";

export interface AutoAssignInput {
  strategy: Exclude<AssignmentStrategy, "manual">;
  reason?: string;
}

export class AssignmentService extends BaseService {
  private readonly repo: AssignmentRepository;
  private readonly leadRepo: LeadRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new AssignmentRepository(organizationId);
    this.leadRepo = new LeadRepository(organizationId);
  }

  /** Eligible assignees for the manual selector. */
  async listEligible() {
    return this.repo.listEligible();
  }

  /** Assignment history timeline for a lead. */
  async history(leadId: string) {
    return this.repo.history(leadId);
  }

  /**
   * Manual assignment: manager picks an eligible executive.
   * Validates eligibility + no-op guard, writes history + audit.
   */
  async manualAssign(
    actor: { userId: string },
    leadId: string,
    assignedToId: string,
    reason?: string,
  ) {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new NotFoundError("Lead not found.");

    if (lead.ownerId === assignedToId) return lead;

    const eligible = await this.repo.listEligible();
    if (!eligible.some((u) => u.id === assignedToId)) {
      throw new ValidationError(
        "Selected user is not eligible for lead assignment.",
      );
    }

    return this.apply(actor, leadId, {
      assignedTo: assignedToId,
      previousOwnerId: lead.ownerId,
      strategy: "manual",
      reason,
    });
  }

  /**
   * Automatic assignment via round_robin / territory / skill.
   */
  async autoAssign(
    actor: { userId: string },
    leadId: string,
    input: AutoAssignInput,
  ) {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new NotFoundError("Lead not found.");

    const target = await this.resolveTarget(lead, input.strategy);
    if (!target) {
      throw new ValidationError(
        `No eligible assignee resolved for strategy "${input.strategy}".`,
      );
    }

    if (lead.ownerId === target) return lead;

    return this.apply(actor, leadId, {
      assignedTo: target,
      previousOwnerId: lead.ownerId,
      strategy: input.strategy,
      reason: input.reason ?? `Auto-assigned via ${input.strategy}.`,
    });
  }

  /** Resolve a deterministic target for automatic strategies. */
  private async resolveTarget(
    lead: {
      geography: string | null;
      industry: string | null;
      companySize: string | null;
      interestedProduct: string | null;
    },
    strategy: Exclude<AssignmentStrategy, "manual">,
  ): Promise<string | null> {
    const eligible = await this.repo.listEligible();
    if (eligible.length === 0) return null;
    const eligibleIds = eligible.map((u) => u.id);

    if (strategy === "round_robin") {
      return this.repo.roundRobinTarget(eligibleIds);
    }

    if (strategy === "territory") {
      const rules = await this.repo.listRoutingRules("territory");
      for (const rule of rules) {
        const fieldValue = this.leadField(lead, rule.conditionField);
        if (
          fieldValue &&
          rule.targetUserId &&
          eligibleIds.includes(rule.targetUserId) &&
          fieldValue.toLowerCase() === rule.conditionValue.toLowerCase()
        ) {
          return rule.targetUserId;
        }
      }
      return this.repo.roundRobinTarget(eligibleIds);
    }

    if (strategy === "skill") {
      const rules = await this.repo.listRoutingRules("skill");
      const skills = await this.repo.listSkills(eligibleIds);
      for (const rule of rules) {
        const fieldValue = this.leadField(lead, rule.conditionField);
        if (!fieldValue) continue;
        const match = skills.find(
          (s) =>
            s.userId === rule.targetUserId &&
            s.skill.toLowerCase() === rule.conditionValue.toLowerCase(),
        );
        if (
          match &&
          match.userId &&
          eligibleIds.includes(match.userId) &&
          fieldValue.toLowerCase() === rule.conditionValue.toLowerCase()
        ) {
          return match.userId;
        }
      }
      return this.repo.roundRobinTarget(eligibleIds);
    }

    return null;
  }

  private leadField(
    lead: {
      geography: string | null;
      industry: string | null;
      companySize: string | null;
      interestedProduct: string | null;
    },
    field: string,
  ): string | null {
    switch (field) {
      case "geography":
        return lead.geography;
      case "industry":
        return lead.industry;
      case "company_size":
        return lead.companySize;
      case "product":
      case "interested_product":
        return lead.interestedProduct;
      default:
        return null;
    }
  }

  /** Shared assignment commit: update owner + write history + audit. */
  private async apply(
    actor: { userId: string },
    leadId: string,
    input: {
      assignedTo: string;
      previousOwnerId: string | null;
      strategy: AssignmentStrategy;
      reason?: string;
    },
  ) {
    await db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({ ownerId: input.assignedTo, updatedAt: new Date() })
        .where(eq(leads.id, leadId));

      await tx.insert(leadAssignments).values({
        organizationId: this.repo.orgId,
        leadId,
        assignedTo: input.assignedTo,
        previousOwnerId: input.previousOwnerId,
        assignedBy: actor.userId,
        strategy: input.strategy,
        reason: input.reason ?? null,
      });
    });

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "assign",
      entityType: "lead",
      entityId: leadId,
      metadata: {
        from: input.previousOwnerId,
        to: input.assignedTo,
        strategy: input.strategy,
      },
    });

    return this.leadRepo.findById(leadId);
  }

  /** Manager telemetry: KPIs + per-user workload. */
  async telemetry() {
    const [kpis, workload, eligible] = await Promise.all([
      this.repo.telemetry(),
      this.repo.workload(),
      this.repo.listEligible(),
    ]);

    return {
      kpis,
      workload,
      eligibleCount: eligible.length,
    };
  }
}
