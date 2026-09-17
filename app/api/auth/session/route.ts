import { success, failure } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    return success(session, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
