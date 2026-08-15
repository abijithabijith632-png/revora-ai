import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { DeduplicationService } from "@/server/services/deduplication";
import { mergeLeadsSchema } from "@/lib/leads/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.edit");
    const { id } = await params;
    const input = await parseBody(req, mergeLeadsSchema);

    const service = new DeduplicationService(session.organizationId);
    const result = await service.merge(
      { userId: session.userId },
      id,
      input.targetLeadId,
    );

    return success(result, { message: "Duplicate merged." });
  } catch (error) {
    return failure(error);
  }
}
