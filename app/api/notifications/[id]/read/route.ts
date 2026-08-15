import { NextRequest } from "next/server";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { NotificationService } from "@/server/services/notifications";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("notifications.view");
    const { id } = await params;

    const service = new NotificationService(session.organizationId);
    const row = await service.markRead(session.userId, id);

    return success(row, { message: "Notification marked as read." });
  } catch (error) {
    return failure(error);
  }
}
