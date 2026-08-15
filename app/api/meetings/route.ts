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
import { MeetingService } from "@/server/services/meetings";
import {
  createMeetingSchema,
  meetingFilterSchema,
} from "@/lib/operations/schemas";

const SORT_ALLOWLIST = ["scheduledAt", "createdAt"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("meetings.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "scheduledAt", "asc");
    const search = parseSearch(url);
    const filters = parseFilters(url, meetingFilterSchema, [
      "status",
      "organizerId",
      "leadId",
    ]);

    const service = new MeetingService(session.organizationId);
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
    const session = await requireApiContext("meetings.create");
    const input = await parseBody(req, createMeetingSchema);

    const service = new MeetingService(session.organizationId);
    const meeting = await service.create({ userId: session.userId }, input);

    return success(meeting, { message: "Meeting scheduled.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
