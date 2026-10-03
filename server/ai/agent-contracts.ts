import { z } from "zod";

export const AGENT_IDS = ["lead", "deal", "account", "followup", "forecast", "meeting"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const agentOutputSchema = z.object({
  summary: z.string().min(1).max(1200),
  findings: z.array(z.string().min(1).max(300)).max(8),
  recommendation: z.string().min(1).max(300),
  suggestedFollowup: z.object({
    contact: z.string().min(1).max(160),
    channel: z.enum(["email", "phone", "whatsapp", "meeting", "other"]),
    message: z.string().min(1).max(1000),
    priority: z.enum(["low", "medium", "high", "urgent"]),
  }).strict().optional(),
  proposedAction: z.object({
    type: z.enum(["create_task", "create_followup", "draft_email", "assign_lead", "none"]),
    title: z.string().min(1).max(200),
    reason: z.string().min(1).max(300),
  }).strict(),
  sourceIds: z.array(z.string().uuid()).max(20),
}).strict();

export const agentActionConfirmationSchema = z.object({
  agentId: z.enum(AGENT_IDS),
  targetId: z.string().uuid().optional(),
  actionType: z.enum(["create_task", "create_followup", "draft_email", "assign_lead"]),
  confirmed: z.literal(true),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).optional(),
  dueAt: z.string().datetime().optional(),
  channel: z.enum(["email", "phone", "whatsapp", "sms", "meeting", "other"]).default("email"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  targetUserId: z.string().uuid().optional(),
  purpose: z.enum(["general_follow_up", "demo_follow_up", "proposal_follow_up", "meeting_confirmation", "re_engagement", "missed_follow_up"]).default("general_follow_up"),
}).strict();
