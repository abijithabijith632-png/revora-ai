import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { AnalyticsService } from "@/server/services/analytics";

export async function GET() {
  try {
    const session = await requireApiContext("analytics.view");
    const service = new AnalyticsService(session.organizationId);

    const [dashboard, leadsOverTime, funnel, sourceAttribution, pipelineByStage] =
      await Promise.all([
        service.dashboard(),
        service.leadsOverTime(30),
        service.funnel(),
        service.sourceAttribution(),
        service.pipelineByStage(),
      ]);

    return success(
      { dashboard, leadsOverTime, funnel, sourceAttribution, pipelineByStage },
      { message: "OK" },
    );
  } catch (error) {
    return failure(error);
  }
}
