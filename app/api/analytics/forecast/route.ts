import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ForecastingService } from "@/server/services/forecasting";

export async function GET() {
  try {
    const session = await requireApiContext("analytics.view");
    const service = new ForecastingService(session.organizationId);
    const forecast = await service.revenueForecast();

    return success(forecast, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
