import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { OpportunityService } from "@/server/services/opportunities";
import { opportunityStageSchema } from "@/lib/opportunities/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("opportunities.edit");
    const { id } = await params;
    const input = await parseBody(req, opportunityStageSchema);

    const service = new OpportunityService(session.organizationId);
    const opp = await service.changeStage({ userId: session.userId }, id, input);

    return success(opp, { message: "Opportunity stage updated." });
  } catch (error) {
    return failure(error);
  }
}
