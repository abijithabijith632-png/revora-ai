import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { EmailTemplateService } from "@/server/services/email-templates";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("proposals.create");
    const { id } = await params;

    const service = new EmailTemplateService(session.organizationId);
    const copy = await service.duplicate({ userId: session.userId }, id);

    return success(copy, { message: "Email template duplicated.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
