import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { EmailTemplateService } from "@/server/services/email-templates";
import { updateEmailTemplateSchema } from "@/lib/commercial/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("proposals.view");
    const { id } = await params;

    const service = new EmailTemplateService(session.organizationId);
    const template = await service.getById(id);

    return success(template, { message: "OK" });
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
    const input = await parseBody(req, updateEmailTemplateSchema);

    const service = new EmailTemplateService(session.organizationId);
    const template = await service.update({ userId: session.userId }, id, input);

    return success(template, { message: "Email template updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("proposals.delete");
    const { id } = await params;

    const service = new EmailTemplateService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Email template archived." });
  } catch (error) {
    return failure(error);
  }
}
