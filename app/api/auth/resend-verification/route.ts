import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { resendVerification, forgotPasswordSchema } from "@/lib/auth";
import { serverEnv } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const { email } = await parseBody(req, forgotPasswordSchema);
    const token = await resendVerification(email);
    // Uniform response regardless of account existence.
    return success(
      { sent: true, verificationToken: serverEnv.isProduction ? undefined : token },
      { message: "If the account exists, a verification email was sent." },
    );
  } catch (error) {
    return failure(error);
  }
}
