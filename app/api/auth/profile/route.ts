import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { requireSession, updateProfile, updateProfileSchema } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireSession();
    return success(session, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseBody(req, updateProfileSchema);
    const updated = await updateProfile(session.userId, input);
    return success(updated, { message: "Profile updated." });
  } catch (error) {
    return failure(error);
  }
}
