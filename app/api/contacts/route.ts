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
import { ContactService } from "@/server/services/contacts";
import { createContactSchema, contactFilterSchema } from "@/lib/clients/schemas";

const SORT_ALLOWLIST = ["firstName", "designation", "createdAt", "clientId"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("contacts.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, contactFilterSchema, [
      "clientId",
      "designation",
      "preferredChannel",
      "isPrimary",
    ]);
    const clientId = url.searchParams.get("clientId") ?? undefined;

    const service = new ContactService(session.organizationId);
    const { rows, total } = await service.list({
      pagination,
      sort,
      search,
      filters,
      clientId,
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
    const session = await requireApiContext("contacts.create");
    const input = await parseBody(req, createContactSchema);

    const service = new ContactService(session.organizationId);
    const contact = await service.create({ userId: session.userId }, input);

    return success(contact, { message: "Contact created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
