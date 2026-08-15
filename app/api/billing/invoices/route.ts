import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { BillingService } from "@/server/services/billing";

export async function GET() {
  try {
    const session = await requireApiContext("billing.view");
    const service = new BillingService(session.organizationId);
    return success(await service.listInvoices(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST() {
  try {
    const session = await requireApiContext("billing.edit");
    const service = new BillingService(session.organizationId);
    const invoice = await service.generateInvoice({ userId: session.userId });
    return success(invoice, { message: "Invoice generated.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
