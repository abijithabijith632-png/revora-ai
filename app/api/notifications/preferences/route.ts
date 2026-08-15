import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { NotificationService } from "@/server/services/notifications";
import { notificationPreferencesSchema } from "@/lib/operations/schemas";

export async function GET() {
  try {
    const session = await requireApiContext("notifications.view");
    const service = new NotificationService(session.organizationId);
    const prefs = await service.getPreferences(session.userId);

    return success(prefs ?? { emailEnabled: true, inAppEnabled: true, types: null }, {
      message: "OK",
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireApiContext("notifications.view");
    const input = await parseBody(req, notificationPreferencesSchema);

    const service = new NotificationService(session.organizationId);
    const prefs = await service.updatePreferences(session.userId, input);

    return success(prefs, { message: "Notification preferences updated." });
  } catch (error) {
    return failure(error);
  }
}
