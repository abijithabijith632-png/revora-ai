import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ForecastingService } from "@/server/services/forecasting";

export async function GET() {
  try {
    const session = await requireApiContext("analytics.view");
    const service = new ForecastingService(session.organizationId);
    const [risk, opportunityRisk] = await Promise.all([service.churnRisk(), service.dealRisks()]);

    return success({ ...risk, opportunityRisks: opportunityRisk.risks, method: opportunityRisk.method, generatedAt: opportunityRisk.generatedAt }, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
