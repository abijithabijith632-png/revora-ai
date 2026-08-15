import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { AnalyticsService } from "@/server/services/analytics";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("analytics.view");
    const url = req.nextUrl;
    // Sales Executive scope: only see their own data.
    const ownerId = url.searchParams.get("ownerId") ?? session.userId;

    const service = new AnalyticsService(session.organizationId);
    const performance = await service.performance(ownerId);

    return success(performance, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
