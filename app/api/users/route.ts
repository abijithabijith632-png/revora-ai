import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { UserAdminService } from "@/server/services/user-admin";

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  roleId: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("users.view");
    const url = req.nextUrl;
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 200);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

    const service = new UserAdminService(session.organizationId);
    const result = await service.list({ search, page, pageSize });
    return success(result.rows, {
      message: "OK",
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
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
