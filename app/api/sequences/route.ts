import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { SalesSequenceService } from "@/server/services/sales-sequences";

const step = z.object({ type: z.enum(["email", "wait", "followup", "activity", "review"]), label: z.string().trim().min(1).max(160), delayMinutes: z.number().int().min(1).max(525600).optional(), description: z.string().max(2000).optional() });
const schema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), steps: z.array(step).min(1).max(30) });
export async function GET() {
  try { const session = await requireApiContext("leads.view"); return success(await new SalesSequenceService(session.organizationId).list()); }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try { const session = await requireApiContext("leads.assign"); const input = await parseBody(req, schema);
    return success(await new SalesSequenceService(session.organizationId).create({ userId: session.userId }, input), { status: 201, message: "Sequence created as draft." }); }
  catch (error) { return failure(error); }
}
