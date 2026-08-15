import { success, failure } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { listOrgUsers } from "@/lib/permissions/rbac-service";
import { ForbiddenError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireSession();
    const allowed = await userHasPermission(session.userId, session.organizationId, "users.view");
    if (!allowed) throw new ForbiddenError("You do not have permission to view users.");
    const users = await listOrgUsers(session.organizationId);
    return success(users, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
