import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { changePassword, changePasswordSchema, requireSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseBody(req, changePasswordSchema);
    await changePassword(session.userId, input);
    return success(null, { message: "Password changed." });
  } catch (error) {
    return failure(error);
  }
}
