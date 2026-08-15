import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { PipelineConfigService } from "@/server/services/pipeline-config";

const createSchema = z.object({
  name: z.string().trim().min(1).max(64),
  key: z.string().trim().min(1).max(32),
  orderIndex: z.number().int().min(0),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireApiContext("pipeline.view");
    const service = new PipelineConfigService(session.organizationId);
    return success(await service.list(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("pipeline.edit");
    const input = parseBody(req, createSchema);
    const service = new PipelineConfigService(session.organizationId);
    const row = await service.create({ userId: session.userId }, await input);
    return success(row, { message: "Pipeline stage created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
