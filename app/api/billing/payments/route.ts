import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { BillingService } from "@/server/services/billing";

export async function GET() {
  try {
    const session = await requireApiContext("billing.view");
    const service = new BillingService(session.organizationId);
    return success(await service.listPayments(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
