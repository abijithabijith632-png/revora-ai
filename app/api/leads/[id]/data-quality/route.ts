import { NextRequest } from "next/server";
import { success, failure, parsePathId } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { DeduplicationService } from "@/server/services/deduplication";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiContext("leads.view");
    const id = await parsePathId(params);
    const result = await new DeduplicationService(session.organizationId).inspectLead(id);
    return success(result, { message: "Lead data quality reviewed." });
  } catch (error) { return failure(error); }
}
