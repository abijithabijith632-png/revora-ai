import { NextRequest } from "next/server";
import { z } from "zod";
import { failure, parseBody, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { EmailDraftService } from "@/server/services/email-draft";

const schema = z.object({ entityType: z.enum(["lead", "contact", "opportunity"]), entityId: z.string().uuid(),
  purpose: z.enum(["general_follow_up", "demo_follow_up", "proposal_follow_up", "meeting_confirmation", "re_engagement", "missed_follow_up"]) });
export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, schema);
    const permission = input.entityType === "lead" ? "leads.view" : input.entityType === "contact" ? "contacts.view" : "opportunities.view";
    const session = await requireApiContext(permission);
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 8, 60_000);
    const draft = await new EmailDraftService(session.organizationId).generate(input);
    return success(draft, { message: "Email draft generated. Review and edit before using." });
  } catch (error) { return failure(error, { log: false }); }
}
