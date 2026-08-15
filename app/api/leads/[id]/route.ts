import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { LeadService } from "@/server/services/leads";
import { updateLeadSchema } from "@/lib/leads/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.view");
    const { id } = await params;

    const service = new LeadService(session.organizationId);
    const lead = await service.getById(id);

    return success(lead, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.edit");
    const { id } = await params;
    const input = parseBody(req, updateLeadSchema);

    const service = new LeadService(session.organizationId);
    const lead = await service.update(
      { userId: session.userId },
      id,
      await input,
    );

    return success(lead, { message: "Lead updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.delete");
    const { id } = await params;

    const service = new LeadService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Lead archived." });
  } catch (error) {
    return failure(error);
  }
}
