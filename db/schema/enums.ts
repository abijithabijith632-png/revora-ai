import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Centralized PostgreSQL enums for fixed states/types.
 * Single source of truth — no scattered status strings.
 * Values are lower_snake_case for database storage; UI mapping lives in the
 * presentation layer (not duplicated here).
 */

export const organizationStatusEnum = pgEnum("organization_status", [
  "active",
  "inactive",
  "suspended",
]);

export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "active",
  "inactive",
  "suspended",
]);

// NOTE: Lead source/status were converted to tenant-configurable varchar
// columns (Phase 16) so organizations can define their own values without
// leaking them across tenants. The canonical system values remain defined in
// lib/leads/schemas.ts (LEAD_SOURCES / LEAD_STATUSES).

export const leadQualificationStatusEnum = pgEnum("lead_qualification_status", [
  "pending",
  "qualified",
  "needs_nurture", // legacy alias for partially_qualified
  "disqualified", // legacy alias for unqualified
  "partially_qualified",
  "unqualified",
]);

/* -------------------------------------------------------------
 * Qualification criteria (Phase 8) — structured controlled values
 * ------------------------------------------------------------ */
export const requirementClarityEnum = pgEnum("requirement_clarity", [
  "clear",
  "partially_clear",
  "unclear",
  "unknown",
]);

export const budgetAvailabilityEnum = pgEnum("budget_availability", [
  "confirmed",
  "estimated",
  "not_confirmed",
  "unknown",
]);

export const purchaseTimelineEnum = pgEnum("purchase_timeline", [
  "immediate",
  "0_30_days",
  "31_90_days",
  "3_6_months",
  "6_plus_months",
  "unknown",
]);

export const decisionMakerEnum = pgEnum("decision_maker", [
  "identified",
  "partially_identified",
  "not_identified",
  "unknown",
]);

export const companyScaleEnum = pgEnum("company_scale", [
  "strong_fit",
  "moderate_fit",
  "weak_fit",
  "unknown",
]);

export const productFitEnum = pgEnum("product_fit", [
  "strong_fit",
  "partial_fit",
  "weak_fit",
  "unknown",
]);

export const conversionProbabilityEnum = pgEnum("conversion_probability", [
  "high",
  "medium",
  "low",
  "unknown",
]);

export const disqualificationReasonEnum = pgEnum("disqualification_reason", [
  "no_budget",
  "poor_product_fit",
  "no_decision_maker",
  "no_active_requirement",
  "timeline_too_distant",
  "duplicate",
  "other",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "inactive",
  "churned",
  "vip",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const followupStatusEnum = pgEnum("followup_status", [
  "pending",
  "completed",
  "skipped",
  "overdue",
  "cancelled",
]);

export const followupChannelEnum = pgEnum("followup_channel", [
  "email",
  "phone",
  "whatsapp",
  "sms",
  "meeting",
  "other",
]);

export const meetingStatusEnum = pgEnum("meeting_status", [
  "scheduled",
  "completed",
  "cancelled",
  "rescheduled",
]);

export const meetingParticipantTypeEnum = pgEnum("meeting_participant_type", [
  "organizer",
  "internal",
  "external",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "call",
  "email",
  "meeting",
  "note",
  "proposal",
  "follow_up",
  "task",
  "payment",
  "status_change",
]);

export const communicationTypeEnum = pgEnum("communication_type", [
  "email",
  "call",
  "sms",
  "whatsapp",
  "meeting",
  "note",
  "other",
]);

export const communicationStatusEnum = pgEnum("communication_status", [
  "draft",
  "sent",
  "delivered",
  "failed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "lead_assigned",
  "follow_up_overdue",
  "proposal_viewed",
  "stage_changed",
  "task_due",
  "meeting_reminder",
  "ai_alert",
  "system",
  // Phase 13 additions (Track A notification types)
  "important_deal_update",
  "assignment",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "proposal",
  "contract",
  "invoice",
  "presentation",
  "nda",
  "other",
]);

export const insightTypeEnum = pgEnum("insight_type", [
  "lead_score",
  "qualification",
  "next_action",
  "follow_up",
  "client_summary",
  "prediction",
  "risk",
  "forecast",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "export",
  "assign",
  "approve",
  "status_change",
]);

/* -------------------------------------------------------------
 * SaaS / billing / invitations (Phase 16)
 * ------------------------------------------------------------ */
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trial",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "void",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);
