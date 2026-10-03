import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { ConversationAnalysisService } from "@/server/services/conversation-analysis";

const schema = z.object({ transcript: z.string().trim().min(20).max(30000) });
export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("ai_insights.view");
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 6, 60_000);
    const input = await parseBody(req, schema);
    return success(await new ConversationAnalysisService().analyze(input), { message: "Conversation text analyzed." });
  } catch (error) { return failure(error, { log: false }); }
}
