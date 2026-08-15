import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { AssignmentService } from "@/server/services/assignment";
import { autoAssignLeadSchema } from "@/lib/leads/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.assign");
    const { id } = await params;
    const input = await parseBody(req, autoAssignLeadSchema);

    const service = new AssignmentService(session.organizationId);
    const lead = await service.autoAssign(
      { userId: session.userId },
      id,
      input,
    );

    return success(lead, { message: "Lead auto-assigned." });
  } catch (error) {
    return failure(error);
  }
}
