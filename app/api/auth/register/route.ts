import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { register, registerSchema } from "@/lib/auth";
import { serverEnv } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, registerSchema);
    const result = await register(input);

    // Development-safe: return the verification token only when not in
    // production (no email provider is configured). Never returned in prod.
    const verificationToken =
      serverEnv.isProduction ? undefined : result.verificationToken;

    return success(
      { userId: result.userId, verificationToken },
      { message: "Account created.", status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
