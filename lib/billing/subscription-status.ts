/**
 * Centralized subscription status definitions (Phase 16).
 * Single source of truth for trial/active/past_due/cancelled/expired.
 */

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trial",
  "active",
  "past_due",
  "cancelled",
  "expired",
];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Active",
  past_due: "Past Due",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** Statuses that still grant feature access (billing is "usable"). */
export const BILLABLE_ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> =
  new Set(["trial", "active", "past_due"]);

export function isSubscriptionActive(status: string): boolean {
  return BILLABLE_ACTIVE_STATUSES.has(status as SubscriptionStatus);
}

export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status as SubscriptionStatus] ?? status;
}
