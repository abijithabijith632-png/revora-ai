import { NextRequest } from "next/server";
import { failure, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { Phase3IntelligenceService } from "@/server/services/phase3-intelligence";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const section = z.enum(["reps"]).nullable().parse(req.nextUrl.searchParams.get("section"));
    const session = await requireApiContext(section === "reps" ? "analytics.view" : "dashboard.view");
    const service = new Phase3IntelligenceService(session.organizationId);
    return success(section === "reps" ? await service.reps(session) : await service.daily(session));
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  try {
    const section = z.enum(["reps"]).nullable().parse(req.nextUrl.searchParams.get("section"));
    const session = await requireApiContext(section === "reps" ? "analytics.view" : "dashboard.view");
    checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 5, 60_000);
    const service = new Phase3IntelligenceService(session.organizationId);
    return success(section === "reps" ? await service.coachReps(session) : await service.brief(session), { message: section === "reps" ? "Coaching observations refreshed." : "Daily sales brief generated." });
  } catch (error) { return failure(error); }
}
