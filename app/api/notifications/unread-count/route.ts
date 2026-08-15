import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { NotificationService } from "@/server/services/notifications";

export async function GET() {
  try {
    const session = await requireApiContext("notifications.view");
    const service = new NotificationService(session.organizationId);
    const count = await service.unreadCount(session.userId);

    return success({ count }, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
