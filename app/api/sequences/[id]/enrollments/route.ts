import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { SalesSequenceService } from "@/server/services/sales-sequences";

const schema = z.object({ leadId: z.string().uuid() });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("leads.assign"); const { id } = await params; const input = await parseBody(req, schema);
    return success(await new SalesSequenceService(session.organizationId).enroll({ userId: session.userId }, id, input.leadId), { status: 201, message: "Lead enrolled." }); }
  catch (error) { return failure(error); }
}
