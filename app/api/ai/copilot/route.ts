import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { AiCopilotService } from "@/server/services/ai-copilot";

const schema = z.object({ question: z.string().trim().min(2).max(500) });
export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("ai_insights.view");
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 12, 60_000);
    const input = await parseBody(req, schema);
    const response = await new AiCopilotService(session.organizationId).ask({ id: session.userId, roleNames: session.roleNames }, input.question);
    return success(response, { message: "Copilot response generated." });
  } catch (error) { return failure(error); }
}
