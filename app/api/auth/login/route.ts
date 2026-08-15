import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { login, loginSchema } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, loginSchema);
    const result = await login(input);
    return success(result, { message: "Signed in." });
  } catch (error) {
    return failure(error);
  }
}
