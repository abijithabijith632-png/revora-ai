import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { SalesSequenceService } from "@/server/services/sales-sequences";

const step = z.object({ type: z.enum(["email", "wait", "followup", "activity", "review"]), label: z.string().trim().min(1).max(160), delayMinutes: z.number().int().min(1).max(525600).optional(), description: z.string().max(2000).optional() });
const schema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().max(2000).nullable().optional(), steps: z.array(step).min(1).max(30) });
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("leads.assign"); const { id } = await params; const input = await parseBody(req, schema);
    return success(await new SalesSequenceService(session.organizationId).update({ userId: session.userId }, id, input), { message: "Sequence updated." }); }
  catch (error) { return failure(error); }
}
