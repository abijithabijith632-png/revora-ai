import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { LeadScoringService } from "@/server/services/lead-scoring";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.view");
    const { id } = await params;

    const service = new LeadScoringService(session.organizationId);
    const result = await service.getForLead(id);

    return success(result, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("leads.edit");
    const { id } = await params;

    // Rate limit expensive AI triggers (per user).
    checkRateLimit(
      rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""),
      10,
      60_000,
    );

    const service = new LeadScoringService(session.organizationId);
    const result = await service.score({ userId: session.userId }, id);

    return success(result, { message: "AI score generated." });
  } catch (error) {
    return failure(error);
  }
}
