import type { BadgeProps } from "@/components/ui/badge";

/**
 * Presentation maps for the commercial/communication layer (Phase 14).
 * Proposal statuses, email template categories, document types/status.
 */

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const PROPOSAL_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "neutral",
  sent: "info",
  viewed: "warning",
  accepted: "success",
  rejected: "danger",
  expired: "neutral",
  cancelled: "neutral",
};

export function proposalStatusLabel(status: string): string {
  return PROPOSAL_STATUS_LABELS[status] ?? status;
}

export function proposalStatusVariant(status: string): BadgeVariant {
  return PROPOSAL_STATUS_VARIANTS[status] ?? "neutral";
}

export const EMAIL_TEMPLATE_CATEGORIES = [
  "introduction",
  "follow_up",
  "proposal_reminder",
  "meeting_confirmation",
  "thank_you",
  "deal_closure",
  "renewal",
] as const;

export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

export const EMAIL_TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  introduction: "Introduction",
  follow_up: "Follow-up",
  proposal_reminder: "Proposal Reminder",
  meeting_confirmation: "Meeting Confirmation",
  thank_you: "Thank You",
  deal_closure: "Deal Closure",
  renewal: "Renewal",
};

export function emailTemplateCategoryLabel(category: string): string {
  return EMAIL_TEMPLATE_CATEGORY_LABELS[category as EmailTemplateCategory] ?? category;
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  proposal: "Proposal",
  contract: "Commercial Agreement",
  invoice: "Invoice",
  presentation: "Presentation",
  nda: "NDA",
  other: "Other",
};

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  archived: "Archived",
  pending_review: "Pending Review",
};

export function documentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}
