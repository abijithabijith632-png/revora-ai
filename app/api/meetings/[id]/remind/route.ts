import { NextRequest } from "next/server";
import { success, failure, parsePathId } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { MeetingService } from "@/server/services/meetings";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("meetings.edit");
    const id = await parsePathId(params);

    const service = new MeetingService(session.organizationId);
    const result = await service.sendReminders(id);

    return success(result, { message: "Meeting reminders sent." });
  } catch (error) {
    return failure(error);
  }
}
