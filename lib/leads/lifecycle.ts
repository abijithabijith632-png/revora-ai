import type { LeadStatus } from "./schemas";

/**
 * Centralized Lead Lifecycle — single source of truth for statuses,
 * controlled transitions, terminal flags, descriptions, and permission
 * requirements. Never scattered across pages, components, or routes.
 */

export interface LifecycleState {
  status: LeadStatus;
  label: string;
  description: string;
  terminal: boolean;
  /** Valid next statuses for a lead currently in this state. */
  allowedNext: LeadStatus[];
  /** Required permission to transition into this state. */
  permission: "leads.edit" | "leads.approve";
}

export const LIFECYCLE_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "converted",
];

export const ALTERNATIVE_STATES: LeadStatus[] = ["unqualified", "lost"];

export const LIFECYCLE_STATES: Record<LeadStatus, LifecycleState> = {
  new: {
    status: "new",
    label: "New",
    description: "Captured but meaningful sales contact has not yet been established.",
    terminal: false,
    allowedNext: ["contacted", "unqualified", "lost"],
    permission: "leads.edit",
  },
  contacted: {
    status: "contacted",
    label: "Contacted",
    description: "Sales team has initiated meaningful contact or engagement.",
    terminal: false,
    allowedNext: ["qualified", "unqualified", "lost"],
    permission: "leads.edit",
  },
  qualified: {
    status: "qualified",
    label: "Qualified",
    description: "Satisfies qualification criteria and is ready for the next commercial stage.",
    terminal: false,
    allowedNext: ["converted", "lost"],
    permission: "leads.edit",
  },
  unqualified: {
    status: "unqualified",
    label: "Unqualified",
    description: "Does not currently meet qualification requirements.",
    terminal: false,
    allowedNext: ["contacted"],
    permission: "leads.edit",
  },
  converted: {
    status: "converted",
    label: "Converted",
    description: "Successfully transitioned into the client/account lifecycle.",
    terminal: true,
    allowedNext: [],
    permission: "leads.approve",
  },
  lost: {
    status: "lost",
    label: "Lost",
    description: "No longer a viable active sales prospect.",
    terminal: true,
    allowedNext: ["contacted"],
    permission: "leads.edit",
  },
};

/** Whether a transition from `from` to `to` is allowed. */
export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  return LIFECYCLE_STATES[from].allowedNext.includes(to);
}

/** All valid next statuses for a given current status (for UI). */
export function allowedNextStatuses(current: LeadStatus): LeadStatus[] {
  return LIFECYCLE_STATES[current].allowedNext;
}

/** Statuses that require a completed qualification assessment to enter. */
export const QUALIFICATION_GATED_STATUSES: LeadStatus[] = ["qualified"];
