import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ProposalService } from "@/server/services/proposals";
import {
  updateProposalSchema,
  proposalStatusSchema,
} from "@/lib/commercial/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("proposals.view");
    const { id } = await params;

    const service = new ProposalService(session.organizationId);
    const proposal = await service.getById(id);

    return success(proposal, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("proposals.edit");
    const { id } = await params;
    const input = await parseBody(req, updateProposalSchema);

    const service = new ProposalService(session.organizationId);
    const proposal = await service.update({ userId: session.userId }, id, input);

    return success(proposal, { message: "Proposal updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("proposals.edit");
    const { id } = await params;
    const input = await parseBody(req, proposalStatusSchema);

    const service = new ProposalService(session.organizationId);
    const proposal = await service.changeStatus({ userId: session.userId }, id, input);

    return success(proposal, { message: "Proposal status updated." });
  } catch (error) {
    return failure(error);
  }
}
