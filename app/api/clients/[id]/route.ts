import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ClientService } from "@/server/services/clients";
import { updateClientSchema, clientStatusSchema } from "@/lib/clients/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("clients.view");
    const { id } = await params;

    const service = new ClientService(session.organizationId);
    const client = await service.getById(id);

    return success(client, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("clients.edit");
    const { id } = await params;
    const input = await parseBody(req, updateClientSchema);

    const service = new ClientService(session.organizationId);
    const client = await service.update({ userId: session.userId }, id, input);

    return success(client, { message: "Client updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("clients.delete");
    const { id } = await params;

    const service = new ClientService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Client archived." });
  } catch (error) {
    return failure(error);
  }
}

/** Status change (PATCH with explicit status action). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("clients.edit");
    const { id } = await params;
    const input = await parseBody(req, clientStatusSchema);

    const service = new ClientService(session.organizationId);
    const client = await service.changeStatus(
      { userId: session.userId },
      id,
      input.status,
    );

    return success(client, { message: "Client status updated." });
  } catch (error) {
    return failure(error);
  }
}
