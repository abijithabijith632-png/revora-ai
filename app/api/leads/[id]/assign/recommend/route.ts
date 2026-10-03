import { NextRequest } from "next/server";
import { failure, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { AssignmentService } from "@/server/services/assignment";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiContext("leads.assign");
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 6, 60_000);
    const { id } = await params;
    const result = await new AssignmentService(session.organizationId).recommend({ userId: session.userId }, id);
    return success(result, { message: "Assignment recommendation ready. Confirm before applying." });
  } catch (error) { return failure(error, { log: false }); }
}
