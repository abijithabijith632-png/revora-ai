import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ConversionService } from "@/server/services/conversion";
import { z } from "zod";

const convertBodySchema = z.object({
  linkToClientId: z.string().uuid().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.view");
    const { id } = await params;

    const service = new ConversionService(session.organizationId);
    const preview = await service.preview(id);

    return success(preview, { message: "OK" });
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
    const input = await parseBody(req, convertBodySchema);

    const service = new ConversionService(session.organizationId);
    const result = await service.convert(
      { userId: session.userId },
      id,
      input,
    );

    return success(result, { message: "Lead converted to client." });
  } catch (error) {
    return failure(error);
  }
}
