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
import { FollowupService } from "@/server/services/followups";
import {
  createFollowupSchema,
  followupFilterSchema,
} from "@/lib/operations/schemas";

const SORT_ALLOWLIST = ["scheduledAt", "priority", "createdAt"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("activities.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "scheduledAt", "asc");
    const search = parseSearch(url);
    const filters = parseFilters(url, followupFilterSchema, [
      "status",
      "channel",
      "clientId",
      "opportunityId",
      "assignedTo",
    ]);

    const service = new FollowupService(session.organizationId);
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
    const session = await requireApiContext("activities.create");
    const input = await parseBody(req, createFollowupSchema);

    const service = new FollowupService(session.organizationId);
    const followup = await service.create({ userId: session.userId }, input);

    return success(followup, { message: "Follow-up scheduled.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
