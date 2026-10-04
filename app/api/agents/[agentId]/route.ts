import { NextRequest } from "next/server";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import type { Permission } from "@/lib/permissions";
import { AgentFramework, agentRequestSchema, getAgentDefinition } from "@/server/ai/agent-framework";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { ValidationError } from "@/lib/errors";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const definition = getAgentDefinition(agentId);
    const session = await requireApiContext(definition.permission as Permission);
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 8, 60_000);
    const input = await parseBody(req, agentRequestSchema);
    if (definition.targetRequired && !input.targetId) throw new ValidationError("This agent requires a valid CRM record ID.");
    const result = await new AgentFramework(session.organizationId).run(agentId as "lead" | "deal" | "account" | "followup" | "forecast" | "meeting", input.targetId, session);
    return success(result, { message: "Agent recommendation ready." });
  } catch (error) { return failure(error); }
}
