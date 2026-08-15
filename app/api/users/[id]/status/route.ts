import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { UserAdminService } from "@/server/services/user-admin";

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("users.edit");
    const { id } = await params;
    const { status } = await parseBody(req, statusSchema);
    const service = new UserAdminService(session.organizationId);
    const row = await service.changeStatus(
      { userId: session.userId, roleNames: session.roleNames },
      id,
      status,
    );
    return success(row, { message: "User status updated." });
  } catch (error) {
    return failure(error);
  }
}
