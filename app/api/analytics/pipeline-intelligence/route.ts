import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ForecastingService } from "@/server/services/forecasting";

export async function GET() {
  try {
    const session = await requireApiContext("analytics.view");
    const insights = await new ForecastingService(session.organizationId).pipelineIntelligence();
    return success(insights, { message: "Pipeline intelligence calculated." });
  } catch (error) { return failure(error); }
}
