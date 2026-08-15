import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { BillingService } from "@/server/services/billing";

const changePlanSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]),
});

export async function GET() {
  try {
    const session = await requireApiContext("billing.view");
    const service = new BillingService(session.organizationId);
    return success(await service.overview(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("billing.edit");
    const { plan } = await parseBody(req, changePlanSchema);
    const service = new BillingService(session.organizationId);
    const sub = await service.changePlan({ userId: session.userId }, plan);
    return success(sub, { message: "Plan updated." });
  } catch (error) {
    return failure(error);
  }
}
