import { success, failure } from "@/lib/api";
import { logout } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await logout();
    return success(null, { message: "Signed out." });
  } catch (error) {
    console.error("[auth:logout]", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return failure(error);
  }
}
