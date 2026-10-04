import { NextRequest } from "next/server";
import { success, failure, parseBody, parsePathId } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { OpportunityService } from "@/server/services/opportunities";
import { opportunityStageSchema } from "@/lib/opportunities/schemas";

async function handleStageChange(
  req: NextRequest,
  params: Promise<{ id: string }>,
) {
  try {
    // Tenant comes from the authenticated session, never the client. Requires
    // opportunities.edit so authorized moves (e.g. Final Review -> Won) return
    // 200, while missing permission returns 403 and unknown ids return 404.
    const session = await requireApiContext("opportunities.edit");
    const id = await parsePathId(params);
    const input = await parseBody(req, opportunityStageSchema);

    const service = new OpportunityService(session.organizationId);
    const opp = await service.changeStage({ userId: session.userId }, id, input);

    return success(opp, { message: "Opportunity stage updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleStageChange(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleStageChange(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleStageChange(req, params);
}
