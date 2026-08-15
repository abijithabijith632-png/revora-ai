import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Reusable audit hook — wraps the Phase 3 `audit_logs` table (no new audit
 * system). Never log secrets, tokens, or passwords.
 */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "assign"
  | "approve"
  | "status_change";

export async function recordAudit(input: {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata,
  });
}
