import { NextRequest } from "next/server";
import { success, failure, parsePagination, buildPaginationMeta } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { NotificationService } from "@/server/services/notifications";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("notifications.view");
    const pagination = parsePagination(req.nextUrl);

    const service = new NotificationService(session.organizationId);
    const { rows, total } = await service.list(session.userId, pagination);

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
