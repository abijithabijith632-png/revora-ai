import { success, failure } from "@/lib/api";
import { logout } from "@/lib/auth";

export async function POST() {
  try {
    await logout();
    return success(null, { message: "Signed out." });
  } catch (error) {
    return failure(error);
  }
}
