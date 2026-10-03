import { NextRequest } from "next/server";
import { failure, success } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { Phase3IntelligenceService } from "@/server/services/phase3-intelligence";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("clients.view"); const { id } = await params; return success(await new Phase3IntelligenceService(session.organizationId).account(z.string().uuid().parse(id))); }
  catch (error) { return failure(error); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireApiContext("clients.view"); checkRateLimit(rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""), 5, 60_000); const { id } = await params; return success(await new Phase3IntelligenceService(session.organizationId).refreshAccount(z.string().uuid().parse(id), session.userId)); }
  catch (error) { return failure(error); }
}
