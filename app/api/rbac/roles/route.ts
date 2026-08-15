import { success, failure } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { listOrgRoles } from "@/lib/permissions/rbac-service";
import { ForbiddenError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireSession();
    const allowed = await userHasPermission(session.userId, session.organizationId, "roles.view");
    if (!allowed) throw new ForbiddenError("You do not have permission to view roles.");
    const roles = await listOrgRoles(session.organizationId);
    return success(roles, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
