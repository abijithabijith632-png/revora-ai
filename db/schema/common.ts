import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Shared column conventions used across all future tables:
 * - UUID primary keys (`id`)
 * - `created_at` / `updated_at` timestamps
 * - `deleted_at` soft-delete support
 * - `organization_id` tenant ownership (on tenant-owned tables)
 */

/** Standard timestamp helper (with timezone). */
export const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();

export const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull();

/** Soft-delete timestamp (null = active). */
export const deletedAt = timestamp("deleted_at", { withTimezone: true });

/**
 * Helper to create an `organization_id` column.
 * Use this on every tenant-owned table to guarantee consistent
 * multi-tenant naming and server-side isolation.
 */
export const organizationIdColumn = () => uuid("organization_id").notNull();
