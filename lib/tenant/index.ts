/**
 * Multi-tenant architecture foundation.
 *
 * `Organization` is the tenant root. Every tenant-owned record must carry an
 * `organization_id`. Tenant isolation is enforced SERVER-SIDE at the query
 * layer — never via client-side filtering alone.
 */

/** The tenant identifier type (matches the `organizations` table UUID). */
export type TenantId = string;

/**
 * Tenant context attached to an authenticated request.
 * Populated by the (future) authentication middleware/hook for every
 * server-side request. Until authentication lands in a later phase, this
 * type establishes the contract.
 */
export interface TenantContext {
  organizationId: TenantId;
  userId: string;
}

/** Symbol key used to store tenant context on an async-local/request scope. */
export const TENANT_CONTEXT_KEY = Symbol("tenant-context");

/**
 * Marker error: thrown when tenant context is missing where required.
 * Uses the existing error hierarchy so callers can map to a 401/403.
 */
export class MissingTenantContextError extends Error {
  constructor() {
    super(
      "Tenant context is required for this operation but was not resolved.",
    );
    this.name = "MissingTenantContextError";
  }
}

/**
 * Resolve the tenant context for the current request.
 *
 * This is intentionally a placeholder that will be wired to the real
 * authentication layer (cookies/session -> user -> organization) in a later
 * phase. It exists now to give services/repositories a stable API contract.
 */
export function getTenantContext(): TenantContext {
  // TODO(auth): resolve from request scope (e.g. AsyncLocalStorage) once
  // authentication is implemented. Throwing here prevents any future code
  // path from accidentally operating without an explicit tenant boundary.
  throw new MissingTenantContextError();
}
