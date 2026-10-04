import { NextRequest } from "next/server";
import { success, failure, parsePathId } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { NotificationService } from "@/server/services/notifications";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("notifications.view");
    const id = await parsePathId(params);

    const service = new NotificationService(session.organizationId);
    const row = await service.remove(session.userId, id);

    return success(row, { message: "Notification dismissed." });
  } catch (error) {
    return failure(error);
  }
}
