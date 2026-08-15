import { requireSession, getSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ForbiddenError } from "@/lib/errors";
import type { Permission } from "@/lib/permissions";
import type { AuthSession } from "@/lib/auth/session";

/**
 * Thin API request context.
 *
 * Resolves the authenticated session (401 if missing) and, when a permission
 * is supplied, enforces it (403 if denied). The tenant/org id always comes
 * from the authenticated session, never the client.
 */
export async function requireApiContext(
  permission?: Permission,
): Promise<AuthSession> {
  const session = await requireSession();

  if (permission) {
    const allowed = await userHasPermission(
      session.userId,
      session.organizationId,
      permission,
    );
    if (!allowed) {
      throw new ForbiddenError(
        "You do not have permission to perform this action.",
      );
    }
  }

  return session;
}

export async function getApiContext(): Promise<AuthSession | null> {
  return getSession();
}
