/**
 * Feature entitlements (Phase 16).
 *
 * Maps a high-level capability to the minimum plan tier that unlocks it.
 * Used by the server-side feature gate; the UI only reflects the result.
 */

import { PLAN_RANK, type PlanKey } from "./plans";

export type FeatureKey =
  | "advanced_reports"
  | "integrations"
  | "custom_configuration"
  | "platform_analytics"
  | "ai_insights";

/** Minimum plan tier required for each feature. */
export const FEATURE_REQUIREMENTS: Record<FeatureKey, PlanKey> = {
  advanced_reports: "STARTER",
  integrations: "PROFESSIONAL",
  custom_configuration: "PROFESSIONAL",
  platform_analytics: "ENTERPRISE",
  ai_insights: "FREE",
};

export interface EntitlementResult {
  allowed: boolean;
  requiredPlan: PlanKey;
  feature: FeatureKey;
}

export function checkEntitlement(
  plan: PlanKey,
  feature: FeatureKey,
): EntitlementResult {
  const requiredPlan = FEATURE_REQUIREMENTS[feature];
  const allowed = PLAN_RANK[plan] >= PLAN_RANK[requiredPlan];
  return { allowed, requiredPlan, feature };
}
