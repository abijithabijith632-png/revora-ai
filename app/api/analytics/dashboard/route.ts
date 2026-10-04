import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { AnalyticsService } from "@/server/services/analytics";

const ALLOWED_RANGES = [7, 30, 90] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("analytics.view");
    const service = new AnalyticsService(session.organizationId);

    const requested = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const days = (ALLOWED_RANGES as readonly number[]).includes(requested)
      ? requested
      : 30;

    const [
      dashboard,
      leadsOverTime,
      opportunitiesOverTime,
      funnel,
      sourceAttribution,
      pipelineByStage,
      leadsByStatus,
      aiScoreDistribution,
    ] = await Promise.all([
      service.dashboard(),
      service.leadsOverTime(days),
      service.opportunitiesOverTime(days),
      service.funnel(),
      service.sourceAttribution(),
      service.pipelineByStage(),
      service.leadsByStatus(),
      service.aiScoreDistribution(),
    ]);

    return success(
      {
        dashboard,
        leadsOverTime,
        opportunitiesOverTime,
        funnel,
        sourceAttribution,
        pipelineByStage,
        leadsByStatus,
        aiScoreDistribution,
        days,
      },
      { message: "OK" },
    );
  } catch (error) {
    return failure(error);
  }
}
