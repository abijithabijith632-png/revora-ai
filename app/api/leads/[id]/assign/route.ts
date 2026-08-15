import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { AssignmentService } from "@/server/services/assignment";
import { LeadService } from "@/server/services/leads";
import { assignLeadSchema } from "@/lib/leads/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.view");
    const { id } = await params;

    const service = new AssignmentService(session.organizationId);
    const [eligible, history] = await Promise.all([
      service.listEligible(),
      service.history(id),
    ]);

    return success({ eligible, history }, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.assign");
    const { id } = await params;
    const input = await parseBody(req, assignLeadSchema);

    // Manual assignment (the only strategy the existing endpoint supports
    // deterministically; automatic strategies use /assign/auto).
    const assignmentService = new AssignmentService(session.organizationId);

    let lead;
    if (input.ownerId === null) {
      const leadService = new LeadService(session.organizationId);
      lead = await leadService.assign(
        { userId: session.userId },
        id,
        { ...input, strategy: input.strategy ?? "manual" },
      );
    } else {
      lead = await assignmentService.manualAssign(
        { userId: session.userId },
        id,
        input.ownerId,
        input.reason,
      );
    }

    return success(lead, { message: "Lead assigned." });
  } catch (error) {
    return failure(error);
  }
}
