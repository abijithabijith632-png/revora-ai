import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { QualificationService } from "@/server/services/qualification";
import { createQualificationSchema } from "@/lib/leads/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.view");
    const { id } = await params;

    const service = new QualificationService(session.organizationId);
    const result = await service.getForLead(id);

    return success(result, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.edit");
    const { id } = await params;
    const input = parseBody(req, createQualificationSchema);

    const service = new QualificationService(session.organizationId);
    const result = await service.assess(
      { userId: session.userId },
      id,
      await input,
    );

    return success(result, { message: "Qualification saved.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
