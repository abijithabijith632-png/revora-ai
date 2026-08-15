import { db } from "@/db";

/**
 * Repository foundation.
 *
 * Repositories are the ONLY place that issue database queries. Services
 * depend on repositories, and route handlers depend on services. This keeps
 * the data-access layer isolated and reusable.
 *
 * Tenant isolation: repositories accept an `organizationId` scope and apply
 * it to every query — never rely on client-supplied filters alone.
 */
export abstract class BaseRepository {
  protected readonly db = db;
}

/**
 * Tenant-scoped repository base.
 *
 * Construct with a resolved `organizationId` (from auth/tenant context in
 * later phases). Concrete repositories extend this so every query they issue
 * is automatically scoped to the current tenant.
 */
export abstract class TenantRepository extends BaseRepository {
  constructor(protected readonly organizationId: string) {
    super();
  }

  /** Public tenant identifier for services that need it. */
  get orgId(): string {
    return this.organizationId;
  }

  /**
   * Helper to build a tenant-scoped `where` equality on any table column.
   * Concrete repositories use this with Drizzle's `eq(...)` + `and(...)`.
   */
  protected scope() {
    return this.organizationId;
  }
}
