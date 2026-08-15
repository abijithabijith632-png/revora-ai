import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { LeadConfigService } from "@/server/services/lead-config";

const upsertSchema = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(128),
  orderIndex: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireApiContext("lead_sources.view");
    const service = new LeadConfigService(session.organizationId);
    return success(await service.listSources(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("lead_sources.create");
    const input = parseBody(req, upsertSchema);
    const service = new LeadConfigService(session.organizationId);
    const row = await service.upsertSource({ userId: session.userId }, await input);
    return success(row, { message: "Lead source saved.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
