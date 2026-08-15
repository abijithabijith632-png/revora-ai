import type { BadgeProps } from "@/components/ui/badge";
import type { LeadSource, LeadStatus } from "./schemas";

/**
 * Presentation maps — human-readable labels and Badge variants for lead
 * enums. Single source of UI text; DB values stay lower_snake_case.
 */

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  google_search: "Google Search",
  referral: "Referral",
  partner_referral: "Partner Referral",
  social_media: "Social Media",
  paid_advertisements: "Paid Advertisements",
  cold_calls: "Cold Calls",
  direct_email: "Direct Email",
  tradeshows_events: "Tradeshows/Events",
  existing_customers: "Existing Customers",
  campaign: "Campaign",
  partner: "Partner",
  manual: "Manual",
  import: "Import",
  api: "API",
  others: "Others",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
  lost: "Lost",
};

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const LEAD_STATUS_VARIANTS: Record<LeadStatus, BadgeVariant> = {
  new: "info",
  contacted: "warning",
  qualified: "success",
  unqualified: "danger",
  converted: "success",
  lost: "neutral",
};

export const QUALIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "Not Assessed",
  qualified: "Qualified",
  needs_nurture: "Partially Qualified",
  disqualified: "Unqualified",
  partially_qualified: "Partially Qualified",
  unqualified: "Unqualified",
};

export const QUALIFICATION_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "neutral",
  qualified: "success",
  needs_nurture: "warning",
  disqualified: "danger",
  partially_qualified: "warning",
  unqualified: "danger",
};

export function sourceLabel(source: string): string {
  return LEAD_SOURCE_LABELS[source as LeadSource] ?? source;
}

export function statusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status as LeadStatus] ?? status;
}

export function statusVariant(status: string): BadgeVariant {
  return LEAD_STATUS_VARIANTS[status as LeadStatus] ?? "neutral";
}

export function qualificationLabel(status: string): string {
  return QUALIFICATION_STATUS_LABELS[status] ?? status;
}

export function qualificationVariant(status: string): BadgeVariant {
  return QUALIFICATION_STATUS_VARIANTS[status] ?? "neutral";
}
