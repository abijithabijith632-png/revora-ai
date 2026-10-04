import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { userHasPermission } from "@/lib/permissions/authorize";
import type { Permission } from "@/lib/permissions";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/lib/api/audit";
import { AgentFramework, getAgentDefinition } from "@/server/ai/agent-framework";
import { TaskService } from "@/server/services/tasks";
import { FollowupService } from "@/server/services/followups";
import { EmailDraftService } from "@/server/services/email-draft";
import { AssignmentService } from "@/server/services/assignment";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { agentActionConfirmationSchema } from "@/server/ai/agent-contracts";

export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, agentActionConfirmationSchema);
    const agent = getAgentDefinition(input.agentId);
    const actionPermission: Permission = input.actionType === "create_task" ? "tasks.create" : input.actionType === "create_followup" ? "activities.create" : input.actionType === "assign_lead" ? "leads.assign" : "ai_insights.view";
    const session = await requireApiContext(agent.permission as Permission);
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 8, 60_000);
    if (!(await userHasPermission(session.userId, session.organizationId, actionPermission))) throw new ForbiddenError("You do not have permission to confirm this agent action.");
    if (!agent.actions.includes(input.actionType)) throw new ValidationError("This agent cannot perform the requested action.");
    const framework = new AgentFramework(session.organizationId);
    const links = await framework.validateActionTarget(input.agentId, input.targetId, session);
    if (input.actionType === "assign_lead") {
      if (input.agentId !== "lead" || !input.targetId || !input.targetUserId) throw new ValidationError("Lead assignment requires a lead and an eligible assignee.");
      const record = await new AssignmentService(session.organizationId).manualAssign({ userId: session.userId }, input.targetId, input.targetUserId, "Confirmed AI agent recommendation.");
      await recordAudit({ organizationId: session.organizationId, userId: session.userId, action: "approve", entityType: "ai_agent_action", entityId: record.id, metadata: { agentId: input.agentId, actionType: input.actionType, targetId: input.targetId, confirmationStatus: "confirmed" } });
      return success({ actionType: input.actionType, result: "Lead assignment confirmed.", recordId: record.id });
    }
    if (input.actionType === "create_task") {
      const task = await new TaskService(session.organizationId).create({ userId: session.userId }, { title: input.title, description: input.description, dueDate: input.dueAt, priority: input.priority, status: "pending", leadId: links.leadId, clientId: links.clientId, opportunityId: links.opportunityId });
      await recordAudit({ organizationId: session.organizationId, userId: session.userId, action: "approve", entityType: "ai_agent_action", entityId: task.id, metadata: { agentId: input.agentId, actionType: input.actionType, targetId: input.targetId ?? null, confirmationStatus: "confirmed" } });
      return success({ actionType: input.actionType, result: "Task created.", recordId: task.id });
    }
    if (input.actionType === "create_followup") {
      if (!links.clientId) throw new ValidationError("A linked account is required to create a follow-up for this record.");
      const followup = await new FollowupService(session.organizationId).create({ userId: session.userId }, { clientId: links.clientId, leadId: links.leadId, opportunityId: links.opportunityId, channel: input.channel, scheduledAt: input.dueAt ?? new Date(Date.now() + 86400000).toISOString(), priority: input.priority, status: "pending", actionDescription: input.title, notes: input.description });
      await recordAudit({ organizationId: session.organizationId, userId: session.userId, action: "approve", entityType: "ai_agent_action", entityId: followup.id, metadata: { agentId: input.agentId, actionType: input.actionType, targetId: input.targetId ?? null, confirmationStatus: "confirmed" } });
      return success({ actionType: input.actionType, result: "Follow-up scheduled.", recordId: followup.id });
    }
    let type: "lead" | "contact" | "opportunity" | undefined; let entityId = input.targetId;
    if (input.agentId === "lead") type = "lead";
    if (input.agentId === "deal") type = "opportunity";
    if (input.agentId === "meeting") {
      const meetingLinks = links;
      if (meetingLinks.leadId) { type = "lead"; entityId = meetingLinks.leadId; }
    }
    if (input.agentId === "account" && input.targetId) {
      const [contact] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.organizationId, session.organizationId), eq(contacts.clientId, input.targetId), eq(contacts.isPrimary, true), eq(contacts.isDeleted, false))).limit(1);
      if (contact) { type = "contact"; entityId = contact.id; }
    }
    if (!type || !entityId) throw new ValidationError("This record has no supported email-draft target.");
    const emailPermission: Permission = type === "lead" ? "leads.view" : type === "opportunity" ? "opportunities.view" : "contacts.view";
    if (!(await userHasPermission(session.userId, session.organizationId, emailPermission))) throw new ForbiddenError("You do not have permission to draft email for this record.");
    const draft = await new EmailDraftService(session.organizationId).generate({ entityType: type, entityId, purpose: input.purpose }, { userId: session.userId, roleNames: session.roleNames });
    await recordAudit({ organizationId: session.organizationId, userId: session.userId, action: "approve", entityType: "ai_agent_action", entityId: entityId, metadata: { agentId: input.agentId, actionType: "draft_email", targetId: input.targetId ?? null, confirmationStatus: "confirmed", sent: false } });
    return success({ actionType: "draft_email", result: "Editable email draft generated; no email was sent.", draft });
  } catch (error) { return failure(error, { log: false }); }
}
