import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { FollowupService } from "@/server/services/followups";

export async function GET() {
  try {
    const session = await requireApiContext("activities.view");
    const service = new FollowupService(session.organizationId);
    const reminders = await service.reminders(session.userId);

    return success(reminders, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
