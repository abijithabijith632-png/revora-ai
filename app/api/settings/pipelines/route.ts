import { NextRequest } from "next/server";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { PipelineConfigService } from "@/server/services/pipeline-config";
import { pipelineSyncSchema } from "@/lib/opportunities/schemas";

/**
 * Replace the organization's pipeline stage configuration in one call
 * (the "+ New Pipeline" flow). Stages holding opportunities cannot be
 * removed; they stay active instead.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("pipeline.edit");
    const input = await parseBody(req, pipelineSyncSchema);
    const stages = await new PipelineConfigService(session.organizationId).syncStages(
      { userId: session.userId },
      input,
    );
    return success(stages, { message: `Pipeline "${input.name.trim()}" saved.`, status: 201 });
  } catch (error) {
    return failure(error);
  }
}
