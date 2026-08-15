/**
 * Centralized SaaS plan definitions (Phase 16).
 *
 * Single source of truth for FREE / STARTER / PROFESSIONAL / ENTERPRISE plans
 * and their limits. Feature-gating and usage enforcement consume this module —
 * plan logic must never be scattered across pages, services, or routes.
 */

export type PlanKey = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface PlanLimits {
  /** Maximum active users (seats). */
  userSeats: number;
  /** Maximum lead records per tenant (null = unlimited). */
  leadStorage: number | null;
  /** Maximum AI scoring/insight requests per month (null = unlimited). */
  aiUsage: number | null;
  /** Advanced reports enabled. */
  advancedReports: boolean;
  /** External integrations enabled. */
  integrations: boolean;
  /** Custom lead statuses/sources + pipeline probability editing. */
  customConfiguration: boolean;
  /** Platform analytics + telemetry visibility. */
  platformAnalytics: boolean;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  /** Monthly price in the org currency; null = free. */
  priceMonthly: number | null;
  limits: PlanLimits;
}

/** Order used for "upgrade" comparison (higher = more capable). */
export const PLAN_RANK: Record<PlanKey, number> = {
  FREE: 0,
  STARTER: 1,
  PROFESSIONAL: 2,
  ENTERPRISE: 3,
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  FREE: {
    key: "FREE",
    name: "Free",
    description: "For individuals evaluating Revora AI.",
    priceMonthly: null,
    limits: {
      userSeats: 2,
      leadStorage: 100,
      aiUsage: 20,
      advancedReports: false,
      integrations: false,
      customConfiguration: false,
      platformAnalytics: false,
    },
  },
  STARTER: {
    key: "STARTER",
    name: "Starter",
    description: "For small sales teams getting started.",
    priceMonthly: 29,
    limits: {
      userSeats: 10,
      leadStorage: 5_000,
      aiUsage: 500,
      advancedReports: true,
      integrations: false,
      customConfiguration: false,
      platformAnalytics: false,
    },
  },
  PROFESSIONAL: {
    key: "PROFESSIONAL",
    name: "Professional",
    description: "For growing teams that need automation and insight.",
    priceMonthly: 99,
    limits: {
      userSeats: 50,
      leadStorage: 50_000,
      aiUsage: 5_000,
      advancedReports: true,
      integrations: true,
      customConfiguration: true,
      platformAnalytics: false,
    },
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    name: "Enterprise",
    description: "For organizations with advanced security and scale needs.",
    priceMonthly: 499,
    limits: {
      userSeats: Number.POSITIVE_INFINITY,
      leadStorage: null,
      aiUsage: null,
      advancedReports: true,
      integrations: true,
      customConfiguration: true,
      platformAnalytics: true,
    },
  },
};

export const DEFAULT_PLAN: PlanKey = "FREE";

export function getPlan(key: string | null | undefined): PlanDefinition {
  return PLANS[(key as PlanKey) ?? DEFAULT_PLAN] ?? PLANS[DEFAULT_PLAN];
}

export function isUpgrade(from: PlanKey, to: PlanKey): boolean {
  return PLAN_RANK[to] > PLAN_RANK[from];
}

export function isDowngrade(from: PlanKey, to: PlanKey): boolean {
  return PLAN_RANK[to] < PLAN_RANK[from];
}
