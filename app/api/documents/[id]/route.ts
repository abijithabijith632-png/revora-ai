import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { DocumentService } from "@/server/services/documents";
import { updateDocumentSchema } from "@/lib/commercial/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("documents.view");
    const { id } = await params;

    const service = new DocumentService(session.organizationId);
    const doc = await service.getById(id);

    return success(doc, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("documents.edit");
    const { id } = await params;
    const input = await parseBody(req, updateDocumentSchema);

    const service = new DocumentService(session.organizationId);
    const doc = await service.update({ userId: session.userId }, id, input);

    return success(doc, { message: "Document updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("documents.delete");
    const { id } = await params;

    const service = new DocumentService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Document archived." });
  } catch (error) {
    return failure(error);
  }
}
