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
import { TaskService } from "@/server/services/tasks";
import { createTaskSchema, taskFilterSchema } from "@/lib/operations/schemas";

const SORT_ALLOWLIST = ["dueDate", "priority", "createdAt"] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("tasks.view");
    const url = req.nextUrl;

    const pagination = parsePagination(url);
    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, taskFilterSchema, [
      "status",
      "priority",
      "assignedTo",
      "clientId",
      "opportunityId",
    ]);

    const service = new TaskService(session.organizationId);
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
    const session = await requireApiContext("tasks.create");
    const input = await parseBody(req, createTaskSchema);

    const service = new TaskService(session.organizationId);
    const task = await service.create({ userId: session.userId }, input);

    return success(task, { message: "Task created.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
