import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { resetPassword, resetPasswordSchema } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, resetPasswordSchema);
    await resetPassword(input);
    return success(null, { message: "Password has been reset." });
  } catch (error) {
    return failure(error);
  }
}
