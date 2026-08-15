import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { LeadService } from "@/server/services/leads";
import { updateLeadStatusSchema } from "@/lib/leads/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.edit");
    const { id } = await params;
    const input = parseBody(req, updateLeadStatusSchema);

    const service = new LeadService(session.organizationId);
    const lead = await service.changeStatus(
      { userId: session.userId },
      id,
      await input,
    );

    return success(lead, { message: "Lead lifecycle updated." });
  } catch (error) {
    return failure(error);
  }
}
