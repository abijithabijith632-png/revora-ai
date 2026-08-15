import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ForecastingService } from "@/server/services/forecasting";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("analytics.view");
    const opportunityId = req.nextUrl.searchParams.get("opportunityId");
    if (!opportunityId) {
      return failure(new Error("opportunityId is required"));
    }

    const service = new ForecastingService(session.organizationId);
    const prediction = await service.dealPrediction(opportunityId);

    return success(prediction, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
