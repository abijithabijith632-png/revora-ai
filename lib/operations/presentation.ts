import type { BadgeProps } from "@/components/ui/badge";

/**
 * Presentation maps for the operations/execution domain (Phase 13).
 * Human-readable labels + Badge variants; DB values stay lower_snake_case.
 */

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/* -------------------------------------------------------------
 * Activities
 * ------------------------------------------------------------ */
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  proposal: "Proposal",
  follow_up: "Follow-up",
  task: "Task",
  payment: "Payment",
  status_change: "Status Change",
};

export const ACTIVITY_TYPE_VARIANTS: Record<string, BadgeVariant> = {
  call: "info",
  email: "neutral",
  meeting: "warning",
  note: "neutral",
  proposal: "warning",
  follow_up: "info",
  task: "success",
  payment: "success",
  status_change: "info",
};

export function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? type;
}

export function activityTypeVariant(type: string): BadgeVariant {
  return ACTIVITY_TYPE_VARIANTS[type] ?? "neutral";
}

/* -------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------ */
export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "To-Do",
  in_progress: "In-Progress",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const TASK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "neutral",
  in_progress: "info",
  completed: "success",
  overdue: "danger",
  cancelled: "neutral",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const TASK_PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export function taskStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

export function taskStatusVariant(status: string): BadgeVariant {
  return TASK_STATUS_VARIANTS[status] ?? "neutral";
}

export function taskPriorityLabel(priority: string): string {
  return TASK_PRIORITY_LABELS[priority] ?? priority;
}

export function taskPriorityVariant(priority: string): BadgeVariant {
  return TASK_PRIORITY_VARIANTS[priority] ?? "neutral";
}

/* -------------------------------------------------------------
 * Follow-ups
 * ------------------------------------------------------------ */
export const FOLLOWUP_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  skipped: "Skipped",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const FOLLOWUP_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "warning",
  completed: "success",
  skipped: "neutral",
  overdue: "danger",
  cancelled: "neutral",
};

export const FOLLOWUP_CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Call",
  whatsapp: "WhatsApp",
  sms: "SMS",
  meeting: "Meeting",
  other: "Other",
};

export function followupStatusLabel(status: string): string {
  return FOLLOWUP_STATUS_LABELS[status] ?? status;
}

export function followupStatusVariant(status: string): BadgeVariant {
  return FOLLOWUP_STATUS_VARIANTS[status] ?? "neutral";
}

export function followupChannelLabel(channel: string): string {
  return FOLLOWUP_CHANNEL_LABELS[channel] ?? channel;
}

/* -------------------------------------------------------------
 * Meetings
 * ------------------------------------------------------------ */
export const MEETING_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export const MEETING_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  scheduled: "info",
  completed: "success",
  cancelled: "neutral",
  rescheduled: "warning",
};

export function meetingStatusLabel(status: string): string {
  return MEETING_STATUS_LABELS[status] ?? status;
}

export function meetingStatusVariant(status: string): BadgeVariant {
  return MEETING_STATUS_VARIANTS[status] ?? "neutral";
}

/* -------------------------------------------------------------
 * Notifications
 * ------------------------------------------------------------ */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  lead_assigned: "Lead Assigned",
  follow_up_overdue: "Follow-up Overdue",
  proposal_viewed: "Proposal Viewed",
  stage_changed: "Opportunity Stage Change",
  task_due: "Task Due",
  meeting_reminder: "Meeting Reminder",
  ai_alert: "AI Alert",
  system: "System Alert",
  important_deal_update: "Important Deal Update",
  assignment: "Assignment",
};

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}
