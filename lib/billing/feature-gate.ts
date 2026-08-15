/**
 * Reusable server-side feature-gating helper (Phase 16).
 *
 * Combines plan entitlement + usage limits into a single, explainable decision
 * so callers can surface a clear upgrade/availability message instead of
 * silently hiding functionality.
 */

import { ForbiddenError } from "@/lib/errors";
import { getPlan, type PlanKey } from "./plans";
import { checkEntitlement, type FeatureKey } from "./entitlements";

export interface UsageSnapshot {
  users: number;
  leads: number;
  aiRequests: number;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  requiredPlan?: PlanKey;
}

function exceeded(current: number, limit: number | null): boolean {
  return limit != null && current >= limit;
}

/**
 * Evaluate whether an organization can use `feature` given its plan and usage.
 * Throws ForbiddenError when denied (with an actionable message).
 */
export function requireFeature(
  planKey: string | null | undefined,
  feature: FeatureKey,
  usage?: Partial<UsageSnapshot>,
): GateResult {
  const plan = getPlan(planKey);

  const entitlement = checkEntitlement(plan.key, feature);
  if (!entitlement.allowed) {
    throw new ForbiddenError(
      `This feature requires the ${entitlement.requiredPlan} plan or higher.`,
    );
  }

  const limits = plan.limits;
  let reason: string | undefined;

  if (usage?.users != null && exceeded(usage.users, limits.userSeats)) {
    reason = `User seat limit reached (${usage.users}/${limits.userSeats}). Upgrade your plan to add more users.`;
  } else if (usage?.leads != null && exceeded(usage.leads, limits.leadStorage)) {
    reason = `Lead storage limit reached (${usage.leads}/${limits.leadStorage}). Upgrade your plan to store more leads.`;
  } else if (
    usage?.aiRequests != null &&
    exceeded(usage.aiRequests, limits.aiUsage)
  ) {
    reason = `AI usage limit reached (${usage.aiRequests}/${limits.aiUsage}). Upgrade your plan for more AI requests.`;
  }

  if (reason) throw new ForbiddenError(reason);

  return { allowed: true };
}

/** Non-throwing variant for read paths that want to render availability. */
export function canUseFeature(
  planKey: string | null | undefined,
  feature: FeatureKey,
  usage?: Partial<UsageSnapshot>,
): GateResult {
  try {
    return requireFeature(planKey, feature, usage);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { allowed: false, reason: err.message };
    }
    throw err;
  }
}
