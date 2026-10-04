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

const SENSITIVE_AUDIT_KEY = /(password|passphrase|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i;

/** Redact sensitive values at both write and audit-log read boundaries. */
export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_AUDIT_KEY.test(key) ? "[REDACTED]" : sanitizeAuditValue(item),
    ]));
  }
  return value;
}

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
    metadata: input.metadata ? sanitizeAuditValue(input.metadata) as Record<string, unknown> : undefined,
  });
}
