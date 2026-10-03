import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { SalesSequenceService } from "@/server/services/sales-sequences";

const schema = z.object({ action: z.enum(["activate", "pause", "resume", "stop"]) });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("leads.assign"); const { id } = await params; const input = await parseBody(req, schema);
    const result = await new SalesSequenceService(session.organizationId).transition({ userId: session.userId }, id, input.action);
    return success(result, { message: `Sequence ${result.status}.` }); }
  catch (error) { return failure(error); }
}
