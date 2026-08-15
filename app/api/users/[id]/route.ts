import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { UserAdminService } from "@/server/services/user-admin";

const patchSchema = z.object({
  fullName: z.string().trim().min(1).max(255).optional(),
  jobTitle: z.string().trim().max(128).nullable().optional(),
  department: z.string().trim().max(128).nullable().optional(),
  designation: z.string().trim().max(128).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("users.edit");
    const { id } = await params;
    const input = parseBody(req, patchSchema);
    const service = new UserAdminService(session.organizationId);
    const row = await service.updateUser(
      { userId: session.userId, roleNames: session.roleNames },
      id,
      await input,
    );
    return success(row, { message: "User updated." });
  } catch (error) {
    return failure(error);
  }
}
