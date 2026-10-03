import { NextRequest } from "next/server";
import { failure, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { Phase3IntelligenceService } from "@/server/services/phase3-intelligence";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("leads.view"); const { id } = await params; return success(await new Phase3IntelligenceService(session.organizationId).intent(z.string().uuid().parse(id), session)); }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("leads.view"); checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 6, 60_000); const { id } = await params; return success(await new Phase3IntelligenceService(session.organizationId).refreshIntent(z.string().uuid().parse(id), session)); }
  catch (error) { return failure(error, { log: false }); }
}
