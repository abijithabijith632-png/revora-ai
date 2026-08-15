import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { SearchService } from "@/server/services/search";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("dashboard.view");
    const term = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 100);

    const service = new SearchService(session.organizationId);
    const results = await service.search(term, limit);

    return success(results, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
