import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { LeadConfigService } from "@/server/services/lead-config";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(128).optional(),
  color: z.string().trim().max(32).nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await requireApiContext("lead_statuses.edit");
    const { key } = await params;
    const input = parseBody(req, patchSchema);
    const service = new LeadConfigService(session.organizationId);
    const row = await service.upsertStatus({ userId: session.userId }, { key, ...(await input) });
    return success(row, { message: "Lead status updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await requireApiContext("lead_statuses.delete");
    const { key } = await params;
    const service = new LeadConfigService(session.organizationId);
    const row = await service.deactivateStatus({ userId: session.userId }, key);
    return success(row, { message: "Lead status deactivated." });
  } catch (error) {
    return failure(error);
  }
}
