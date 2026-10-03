import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { parseAndValidate } from "@/lib/validation";
import { NextActionService } from "@/server/services/next-action";

const querySchema = z.object({ entityType: z.enum(["lead", "opportunity"]), entityId: z.string().uuid() });

export async function GET(req: NextRequest) {
  try {
    const query = parseAndValidate(querySchema, Object.fromEntries(req.nextUrl.searchParams));
    const session = await requireApiContext(query.entityType === "lead" ? "leads.view" : "opportunities.view");
    const result = await new NextActionService(session.organizationId).suggest(query);
    return success(result, { message: "OK" });
  } catch (error) { return failure(error); }
}
