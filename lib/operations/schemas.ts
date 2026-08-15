import { z } from "zod";

/**
 * Operations/execution validation schemas (Phase 13) — shared by route
 * handlers and client forms. Values mirror PostgreSQL enums in
 * db/schema/enums.ts (lower_snake_case storage).
 */

function emptyToUndefined(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

function optionalString(max = 255) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
}

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date.")
    .optional(),
);

const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid().nullish());

/* -------------------------------------------------------------
 * Activities
 * ------------------------------------------------------------ */
export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
  "proposal",
  "follow_up",
  "task",
  "payment",
  "status_change",
] as const;

export const createActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: optionalString(255),
  notes: optionalString(10_000),
  metadata: z.record(z.unknown()).optional(),
  leadId: optionalUuid,
  clientId: optionalUuid,
  contactId: optionalUuid,
  opportunityId: optionalUuid,
  occurredAt: optionalDate,
});

export const updateActivitySchema = createActivitySchema.partial();

export const activityFilterSchema = z.object({
  type: z.enum(ACTIVITY_TYPES).optional(),
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
});

/* -------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------ */
export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required.").max(255),
  description: optionalString(10_000),
  assignedTo: optionalUuid,
  dueDate: optionalDate,
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("pending"),
  leadId: optionalUuid,
  clientId: optionalUuid,
  opportunityId: optionalUuid,
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
});

export const taskReassignSchema = z.object({
  assignedTo: z.string().uuid(),
});

export const taskFilterSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
});

/* -------------------------------------------------------------
 * Follow-ups
 * ------------------------------------------------------------ */
export const FOLLOWUP_STATUSES = [
  "pending",
  "completed",
  "skipped",
  "overdue",
  "cancelled",
] as const;

export const FOLLOWUP_CHANNELS = [
  "email",
  "phone",
  "whatsapp",
  "sms",
  "meeting",
  "other",
] as const;

export const createFollowupSchema = z.object({
  clientId: z.string().uuid(),
  opportunityId: optionalUuid,
  leadId: optionalUuid,
  contactId: optionalUuid,
  assignedTo: optionalUuid,
  channel: z.enum(FOLLOWUP_CHANNELS).default("email"),
  scheduledAt: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date/time."),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(FOLLOWUP_STATUSES).default("pending"),
  actionDescription: optionalString(10_000),
  notes: optionalString(10_000),
});

export const updateFollowupSchema = createFollowupSchema.partial().extend({
  clientId: z.string().uuid().optional(),
  scheduledAt: createFollowupSchema.shape.scheduledAt.optional(),
});

export const followupStatusSchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES),
});

export const followupFilterSchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES).optional(),
  channel: z.enum(FOLLOWUP_CHANNELS).optional(),
  clientId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
});

/* -------------------------------------------------------------
 * Meetings
 * ------------------------------------------------------------ */
export const MEETING_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "rescheduled",
] as const;

export const meetingParticipantSchema = z.object({
  userId: z.string().uuid().nullish(),
  contactId: z.string().uuid().nullish(),
  participantType: z.enum(["organizer", "internal", "external"]).default("internal"),
});

export const meetingActionItemSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  assigneeId: z.string().uuid().nullish(),
  completed: z.boolean().default(false),
});

export const createMeetingSchema = z.object({
  title: z.string().trim().min(1, "Meeting title is required.").max(255),
  description: optionalString(10_000),
  scheduledAt: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date/time."),
  durationMinutes: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z.number().int().min(1).max(1440).optional(),
    ),
  organizerId: optionalUuid,
  leadId: optionalUuid,
  virtualLink: z.preprocess(
    emptyToUndefined,
    z.string().trim().url("Enter a valid URL.").max(255).optional(),
  ),
  status: z.enum(MEETING_STATUSES).default("scheduled"),
  agenda: optionalString(10_000),
  notes: optionalString(10_000),
  outcome: optionalString(10_000),
  actionItems: z.array(meetingActionItemSchema).max(100).optional(),
  participants: z.array(meetingParticipantSchema).max(100).optional(),
});

export const updateMeetingSchema = createMeetingSchema.partial();

export const meetingStatusSchema = z.object({
  status: z.enum(MEETING_STATUSES),
});

export const meetingFilterSchema = z.object({
  status: z.enum(MEETING_STATUSES).optional(),
  organizerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
});

/* -------------------------------------------------------------
 * Notifications
 * ------------------------------------------------------------ */
export const NOTIFICATION_TYPES = [
  "lead_assigned",
  "follow_up_overdue",
  "proposal_viewed",
  "stage_changed",
  "task_due",
  "meeting_reminder",
  "ai_alert",
  "system",
  "important_deal_update",
  "assignment",
] as const;

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  types: z.record(z.enum(NOTIFICATION_TYPES), z.boolean()).optional(),
});

/* -------------------------------------------------------------
 * Inferred types
 * ------------------------------------------------------------ */
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ActivityFilter = z.infer<typeof activityFilterSchema>;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskStatusInput = z.infer<typeof taskStatusSchema>;
export type TaskReassignInput = z.infer<typeof taskReassignSchema>;
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export type CreateFollowupInput = z.infer<typeof createFollowupSchema>;
export type UpdateFollowupInput = z.infer<typeof updateFollowupSchema>;
export type FollowupStatusInput = z.infer<typeof followupStatusSchema>;
export type FollowupFilter = z.infer<typeof followupFilterSchema>;

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type MeetingStatusInput = z.infer<typeof meetingStatusSchema>;
export type MeetingFilter = z.infer<typeof meetingFilterSchema>;

export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;
