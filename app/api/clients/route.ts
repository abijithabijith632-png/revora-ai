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
import { ClientService } from "@/server/services/clients";
import { createClientSchema, clientFilterSchema } from "@/lib/clients/schemas";

const SORT_ALLOWLIST = [
  "companyName",
  "createdAt",
  "customerSince",
  "status",
  "accountManagerId",
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("clients.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, clientFilterSchema, [
      "status",
      "industry",
      "accountManagerId",
    ]);

    const service = new ClientService(session.organizationId);
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
    const session = await requireApiContext("clients.create");
    const input = await parseBody(req, createClientSchema);

    const service = new ClientService(session.organizationId);
    const client = await service.create({ userId: session.userId }, input);

    return success(client, { message: "Client created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
