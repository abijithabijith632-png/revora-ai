import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { recordAudit } from "@/lib/api/audit";
import { ForecastingService } from "@/server/services/forecasting";
import { NotificationService } from "@/server/services/notifications";
import { db } from "@/db";
import { followups, leads, users } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";

/** Explicitly triggered, daily-deduplicated alerts for newly high-risk deals. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("analytics.view");
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 5, 60_000);
    const [{ risks, truncated }, highIntentLeads, overdueFollowups, organizationUsers] = await Promise.all([
      new ForecastingService(session.organizationId).dealRisks(),
      db.select({ id: leads.id, name: leads.fullName, ownerId: leads.ownerId, score: leads.aiScore })
        .from(leads).where(and(eq(leads.organizationId, session.organizationId), eq(leads.isDeleted, false), gte(leads.aiScore, 80))).limit(50),
      db.select({ id: followups.id, ownerId: followups.assignedTo, description: followups.actionDescription, scheduledAt: followups.scheduledAt })
        .from(followups).where(and(eq(followups.organizationId, session.organizationId), eq(followups.status, "pending"),
          // Ignore very old backlog items; those should be triaged in the CRM.
          gte(followups.scheduledAt, new Date(Date.now() - 30 * 86400000)), lt(followups.scheduledAt, new Date())))
        .limit(100),
      db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, session.organizationId), eq(users.status, "active"), eq(users.isDeleted, false))),
    ]);
    const validUserIds = new Set(organizationUsers.map((user) => user.id));
    const notificationService = new NotificationService(session.organizationId);
    let created = 0;
    const emit = async (input: { userId: string; title: string; message: string; entityType: string; entityId: string; method: string }) => {
      const notification = await notificationService.notify({ ...input, type: "ai_alert" });
      if (!notification) return;
      created++;
      await recordAudit({ organizationId: session.organizationId, userId: session.userId, action: "create",
        entityType: "notification", entityId: notification.id,
        metadata: { relatedEntityType: input.entityType, relatedEntityId: input.entityId, method: input.method } });
    };
    for (const risk of risks.filter((item) => item.riskScore >= 60)) {
      await emit({
        userId: risk.ownerId && validUserIds.has(risk.ownerId) ? risk.ownerId : session.userId,
        title: `Opportunity risk: ${risk.opportunityName}`,
        message: risk.reasons.join(" "),
        entityType: "opportunity", method: "deterministic_crm_signals",
        entityId: risk.opportunityId,
      });
    }
    for (const lead of highIntentLeads) {
      await emit({ userId: lead.ownerId && validUserIds.has(lead.ownerId) ? lead.ownerId : session.userId,
        title: `High-intent lead: ${lead.name}`, message: `Existing lead score is ${lead.score}/100. Review the CRM evidence and choose a next step.`,
        entityType: "lead", entityId: lead.id, method: "existing_lead_score" });
    }
    for (const followup of overdueFollowups.filter((item) => item.scheduledAt < new Date())) {
      await emit({ userId: followup.ownerId && validUserIds.has(followup.ownerId) ? followup.ownerId : session.userId,
        title: "Missed follow-up", message: followup.description ?? "A scheduled follow-up is overdue.",
        entityType: "followup", entityId: followup.id, method: "recorded_followup_schedule" });
    }
    return success({ created, evaluated: risks.length + highIntentLeads.length + overdueFollowups.length,
      opportunityRiskScanTruncated: truncated, deduplicationWindowHours: 24 }, { message: "CRM alert signals evaluated." });
  } catch (error) { return failure(error); }
}
