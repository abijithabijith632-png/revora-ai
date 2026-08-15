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
import { LeadService } from "@/server/services/leads";
import {
  createLeadSchema,
  leadFilterSchema,
} from "@/lib/leads/schemas";

const SORT_ALLOWLIST = [
  "createdAt",
  "updatedAt",
  "fullName",
  "companyName",
  "status",
  "source",
  "aiScore",
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("leads.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, leadFilterSchema, [
      "status",
      "source",
      "ownerId",
    ]);

    const service = new LeadService(session.organizationId);
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
    const session = await requireApiContext("leads.create");
    const input = parseBody(req, createLeadSchema);

    const service = new LeadService(session.organizationId);
    const lead = await service.create(
      { userId: session.userId },
      await input,
    );

    return success(lead, { message: "Lead created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
