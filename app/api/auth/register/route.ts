import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { register, registerSchema } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, registerSchema);
    const result = await register(input);
    return success(result, { message: "Account created.", status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("[register:validation]", {
        fieldErrors: error.details,
        path: req.nextUrl.pathname,
      });
    } else {
      console.error("[auth:register]", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        path: req.nextUrl.pathname,
      });
    }
    return failure(error);
  }
}
