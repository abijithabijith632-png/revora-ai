import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { login, loginSchema } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, loginSchema);
    const result = await login(input);
    return success(result, { message: "Signed in." });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("[login:validation]", {
        fieldErrors: error.details,
        path: req.nextUrl.pathname,
      });
    } else {
      console.error("[auth:login]", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        path: req.nextUrl.pathname,
      });
    }
    return failure(error);
  }
}
