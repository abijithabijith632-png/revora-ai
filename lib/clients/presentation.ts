import type { BadgeProps } from "@/components/ui/badge";

/**
 * Presentation maps for clients + contacts — human-readable labels and Badge
 * variants. DB values stay lower_snake_case.
 */

export const CLIENT_STATUSES = [
  "active",
  "inactive",
  "churned",
  "vip",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  churned: "Churned",
  vip: "VIP",
};

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const CLIENT_STATUS_VARIANTS: Record<ClientStatus, BadgeVariant> = {
  active: "success",
  inactive: "neutral",
  churned: "danger",
  vip: "ai",
};

export function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status as ClientStatus] ?? status;
}

export function clientStatusVariant(status: string): BadgeVariant {
  return CLIENT_STATUS_VARIANTS[status as ClientStatus] ?? "neutral";
}

export const PREFERRED_CHANNELS = ["email", "phone", "whatsapp"] as const;
export type PreferredChannel = (typeof PREFERRED_CHANNELS)[number];

export const PREFERRED_CHANNEL_LABELS: Record<PreferredChannel, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
};

export function preferredChannelLabel(channel: string): string {
  return PREFERRED_CHANNEL_LABELS[channel as PreferredChannel] ?? channel;
}
