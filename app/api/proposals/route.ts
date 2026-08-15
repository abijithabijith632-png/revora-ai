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
import { ProposalService } from "@/server/services/proposals";
import {
  createProposalSchema,
  proposalFilterSchema,
} from "@/lib/commercial/schemas";

const SORT_ALLOWLIST = ["createdAt", "amount"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("proposals.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, proposalFilterSchema, [
      "status",
      "opportunityId",
      "clientId",
      "ownerId",
    ]);

    const service = new ProposalService(session.organizationId);
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
    const session = await requireApiContext("proposals.create");
    const input = await parseBody(req, createProposalSchema);

    const service = new ProposalService(session.organizationId);
    const proposal = await service.create({ userId: session.userId }, input);

    return success(proposal, { message: "Proposal created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
