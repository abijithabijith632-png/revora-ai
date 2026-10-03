import { NextRequest } from "next/server";
import { failure, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { MeetingSummaryService } from "@/server/services/meeting-summary";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiContext("meetings.view");
    const { id } = await params;
    return success(await new MeetingSummaryService(session.organizationId).latest(id));
  } catch (error) { return failure(error, { log: false }); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiContext("meetings.view");
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 6, 60_000);
    const { id } = await params;
    return success(await new MeetingSummaryService(session.organizationId).generate({ userId: session.userId }, id), { message: "Meeting notes summarized." });
  } catch (error) { return failure(error); }
}
