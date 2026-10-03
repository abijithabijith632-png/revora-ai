import { BaseService } from "./base";
import { LeadRepository } from "@/server/repositories/leads";
import { OpportunityRepository } from "@/server/repositories/opportunities";
import { ActivityService } from "./activities";
import { z } from "zod";
import { parseAndValidate } from "@/lib/validation";
import type { ExplainableAiResult } from "@/types/ai";
import type { NextActionService as NextActionCapability } from "@/services/ai/types";

const inputSchema = z.object({ entityType: z.enum(["lead", "opportunity"]), entityId: z.string().uuid() });
type ActionSuggestion = ExplainableAiResult<string> & {
  entityType: "lead" | "opportunity"; entityId: string; action: string; reason: string;
  method: "deterministic_crm_rules"; generatedAt: string;
};

/** Evidence-based next-step suggestions; no provider call or fabricated context. */
export class NextActionService extends BaseService implements NextActionCapability {
  constructor(private readonly organizationId: string) { super(); }

  async suggest(rawInput: unknown): Promise<ActionSuggestion> {
    const input = parseAndValidate(inputSchema, rawInput);
    const activities = new ActivityService(this.organizationId);
    if (input.entityType === "lead") {
      const lead = await new LeadRepository(this.organizationId).findById(input.entityId);
      if (!lead) return this.format(input, "No recommendation available", "This lead was not found in the current organization.", "low");
      const timeline = await activities.timeline("lead", input.entityId);
      const last = timeline[0]?.occurredAt ?? null;
      let action = "Review the lead and choose a relevant next step";
      let reason = "The CRM does not contain enough engagement context to choose a more specific action.";
      if (lead.status === "new") {
        action = "Contact the lead"; reason = "The lead is still marked new in the CRM.";
      } else if (!last || Date.now() - new Date(last).getTime() >= 14 * 86400000) {
        action = "Schedule a follow-up"; reason = last ? "No activity is recorded in the last 14 days." : "No activity is recorded for this lead.";
      } else if (lead.qualificationStatus === "pending") {
        action = "Complete lead qualification"; reason = "The lead qualification status is pending.";
      }
      return this.format(input, action, reason, last ? "moderate" : "low");
    }
    const opportunity = await new OpportunityRepository(this.organizationId).findById(input.entityId);
    if (!opportunity) return this.format(input, "No recommendation available", "This opportunity was not found in the current organization.", "low");
    const timeline = await activities.timeline("opportunity", input.entityId);
    const last = timeline[0]?.occurredAt ?? null;
    let action = "Review opportunity progress";
    let reason = "Use the current stage and recorded deal details to confirm the next step.";
    if (opportunity.expectedCloseDate && opportunity.expectedCloseDate < new Date()) {
      action = "Review the close date with the deal owner"; reason = "The expected close date has passed.";
    } else if (!last || Date.now() - new Date(last).getTime() >= 14 * 86400000) {
      action = "Schedule a customer follow-up"; reason = last ? "No activity is recorded in the last 14 days." : "No activity is recorded for this opportunity.";
    } else if (/proposal/i.test(opportunity.stageName ?? "")) {
      action = "Follow up on the proposal"; reason = `The opportunity is in the ${opportunity.stageName} stage.`;
    } else if (/negotiat/i.test(opportunity.stageName ?? "")) {
      action = "Confirm the next negotiation step"; reason = `The opportunity is in the ${opportunity.stageName} stage.`;
    }
    return this.format(input, action, reason, last ? "moderate" : "low");
  }

  private format(input: z.infer<typeof inputSchema>, action: string, reason: string, confidenceLevel: "low" | "moderate"): ActionSuggestion {
    const generatedAt = new Date().toISOString();
    return { entityType: input.entityType, entityId: input.entityId, action, reason, result: action,
      reasons: [reason], positiveSignals: [], riskSignals: [], recommendation: action,
      confidence: confidenceLevel === "moderate" ? 60 : 25,
      supportingData: { method: "deterministic_crm_rules", confidenceLevel, generatedAt },
      method: "deterministic_crm_rules", generatedAt };
  }
}
