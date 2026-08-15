import { NextRequest } from "next/server";
import {
  success,
  failure,
  parseBody,
  parsePagination,
  parseSort,
  parseSearch,
  parseFilters,
  buildPaginationMeta,
} from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { OpportunityService } from "@/server/services/opportunities";
import { createOpportunitySchema, opportunityFilterSchema } from "@/lib/opportunities/schemas";

const SORT_ALLOWLIST = [
  "name",
  "createdAt",
  "amount",
  "probability",
  "expectedCloseDate",
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("opportunities.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, opportunityFilterSchema, [
      "stageKey",
      "clientId",
      "ownerId",
    ]);

    const service = new OpportunityService(session.organizationId);
    const { rows, total } = await service.list({
      pagination,
      sort,
      search,
      filters,
    });

    return success(rows, {
      message: "OK",
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: buildPaginationMeta(total, pagination).totalPages,
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("opportunities.create");
    const input = await parseBody(req, createOpportunitySchema);

    const service = new OpportunityService(session.organizationId);
    const opp = await service.create({ userId: session.userId }, input);

    return success(opp, { message: "Opportunity created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
