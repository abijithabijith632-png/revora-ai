import { success, failure } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ForbiddenError } from "@/lib/errors";
import { PlatformService } from "@/server/services/platform";

export async function GET() {
  try {
    const session = await requireSession();
    const [user] = await db
      .select({ isPlatformAdmin: users.isPlatformAdmin })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user?.isPlatformAdmin) {
      throw new ForbiddenError("Platform admin access required.");
    }

    const service = new PlatformService();
    return success(await service.telemetry(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
