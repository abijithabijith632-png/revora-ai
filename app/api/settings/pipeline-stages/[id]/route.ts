import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { PipelineConfigService } from "@/server/services/pipeline-config";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  orderIndex: z.number().int().min(0).optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("pipeline.edit");
    const { id } = await params;
    const input = parseBody(req, patchSchema);
    const service = new PipelineConfigService(session.organizationId);
    const row = await service.update({ userId: session.userId }, id, await input);
    return success(row, { message: "Pipeline stage updated." });
  } catch (error) {
    return failure(error);
  }
}
