import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { NotificationService } from "@/server/services/notifications";

export async function POST() {
  try {
    const session = await requireApiContext("notifications.view");
    const service = new NotificationService(session.organizationId);
    const result = await service.markAllRead(session.userId);

    return success(result, { message: "All notifications marked as read." });
  } catch (error) {
    return failure(error);
  }
}
