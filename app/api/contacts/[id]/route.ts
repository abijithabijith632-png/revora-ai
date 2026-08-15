import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ContactService } from "@/server/services/contacts";
import { updateContactSchema } from "@/lib/clients/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("contacts.view");
    const { id } = await params;

    const service = new ContactService(session.organizationId);
    const contact = await service.getById(id);

    return success(contact, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("contacts.edit");
    const { id } = await params;
    const input = await parseBody(req, updateContactSchema);

    const service = new ContactService(session.organizationId);
    const contact = await service.update({ userId: session.userId }, id, input);

    return success(contact, { message: "Contact updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("contacts.delete");
    const { id } = await params;

    const service = new ContactService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Contact archived." });
  } catch (error) {
    return failure(error);
  }
}
