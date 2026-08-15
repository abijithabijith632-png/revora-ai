import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { DeduplicationService } from "@/server/services/deduplication";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.view");
    const { id } = await params;

    const service = new DeduplicationService(session.organizationId);
    const duplicates = await service.findDuplicates(id);

    return success(duplicates, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
