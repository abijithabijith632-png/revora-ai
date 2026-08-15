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
import { DocumentService } from "@/server/services/documents";
import {
  createDocumentSchema,
  documentFilterSchema,
} from "@/lib/commercial/schemas";

const SORT_ALLOWLIST = ["name", "createdAt"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("documents.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, documentFilterSchema, [
      "documentType",
      "clientId",
      "opportunityId",
      "status",
    ]);

    const service = new DocumentService(session.organizationId);
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
    const session = await requireApiContext("documents.create");
    const input = await parseBody(req, createDocumentSchema);

    const service = new DocumentService(session.organizationId);
    const doc = await service.create({ userId: session.userId }, input);

    return success(doc, { message: "Document recorded.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
