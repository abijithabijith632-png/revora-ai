import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { forgotPassword, forgotPasswordSchema } from "@/lib/auth";
import { serverEnv } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const { email } = await parseBody(req, forgotPasswordSchema);
    const token = await forgotPassword({ email });
    // Uniform response regardless of account existence.
    return success(
      { sent: true, resetToken: serverEnv.isProduction ? undefined : token },
      { message: "If the account exists, a password reset email was sent." },
    );
  } catch (error) {
    return failure(error);
  }
}
