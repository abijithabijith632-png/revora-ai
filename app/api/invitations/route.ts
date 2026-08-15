import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { UserAdminService } from "@/server/services/user-admin";
import { InvitationRepository } from "@/server/repositories/invitations";

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  roleId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  try {
    const session = await requireApiContext("invitations.view");
    const repo = new InvitationRepository(session.organizationId);
    return success(await repo.list(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("invitations.create");
    const input = parseBody(req, inviteSchema);
    const service = new UserAdminService(session.organizationId);
    const result = await service.invite(
      { userId: session.userId, roleNames: session.roleNames },
      { email: (await input).email, roleId: (await input).roleId ?? null },
    );
    return success(result, { message: "Invitation created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
