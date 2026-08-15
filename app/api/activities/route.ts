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
import { ActivityService } from "@/server/services/activities";
import {
  createActivitySchema,
  activityFilterSchema,
} from "@/lib/operations/schemas";

const SORT_ALLOWLIST = ["occurredAt", "createdAt"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("activities.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "occurredAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, activityFilterSchema, [
      "type",
      "leadId",
      "clientId",
      "contactId",
      "opportunityId",
    ]);

    const service = new ActivityService(session.organizationId);
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
    const input = await parseBody(req, createActivitySchema);

    const service = new ActivityService(session.organizationId);
    const activity = await service.create({ userId: session.userId }, input);

    return success(activity, { message: "Activity logged.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
