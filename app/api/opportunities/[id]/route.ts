import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { OpportunityService } from "@/server/services/opportunities";
import { updateOpportunitySchema } from "@/lib/opportunities/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("opportunities.view");
    const { id } = await params;

    const service = new OpportunityService(session.organizationId);
    const opp = await service.getById(id);

    return success(opp, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("opportunities.edit");
    const { id } = await params;
    const input = await parseBody(req, updateOpportunitySchema);

    const service = new OpportunityService(session.organizationId);
    const opp = await service.update({ userId: session.userId }, id, input);

    return success(opp, { message: "Opportunity updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("opportunities.delete");
    const { id } = await params;

    const service = new OpportunityService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Opportunity archived." });
  } catch (error) {
    return failure(error);
  }
}
