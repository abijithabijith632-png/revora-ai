import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure } from "@/lib/api";
import { parseAndValidate } from "@/lib/validation";
import { requireSession } from "@/lib/auth";
import { assignRole } from "@/lib/permissions/rbac-service";

const schema = z.object({ roleId: z.string().uuid() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id: targetUserId } = await params;
    const { roleId } = parseAndValidate(schema, await req.json().catch(() => null));
    const result = await assignRole(session, targetUserId, roleId);
    return success(result, { message: "Role assigned." });
  } catch (error) {
    return failure(error);
  }
}
