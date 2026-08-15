import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { UserAdminService } from "@/server/services/user-admin";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/auth/tokens";
import { ForbiddenError } from "@/lib/errors";

const acceptSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(72),
});

export async function POST(req: NextRequest) {
  try {
    // Public endpoint: resolve the invitation's organization server-side from
    // the token hash (never trust a client-supplied org id).
    const input = parseBody(req, acceptSchema);
    const { token, fullName, password } = await input;

    const invite = await db.query.invitations.findFirst({
      where: eq(invitations.tokenHash, hashToken(token)),
    });
    if (!invite) throw new ForbiddenError("Invalid invitation.");

    const service = new UserAdminService(invite.organizationId);
    const result = await service.acceptInvitation(token, { fullName, password });
    return success(result, { message: "Invitation accepted.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
