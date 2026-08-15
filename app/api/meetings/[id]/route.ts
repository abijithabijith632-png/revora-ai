import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { MeetingService } from "@/server/services/meetings";
import {
  updateMeetingSchema,
  meetingStatusSchema,
} from "@/lib/operations/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("meetings.view");
    const { id } = await params;

    const service = new MeetingService(session.organizationId);
    const meeting = await service.getById(id);

    return success(meeting, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("meetings.edit");
    const { id } = await params;
    const input = await parseBody(req, updateMeetingSchema);

    const service = new MeetingService(session.organizationId);
    const meeting = await service.update({ userId: session.userId }, id, input);

    return success(meeting, { message: "Meeting updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("meetings.delete");
    const { id } = await params;

    const service = new MeetingService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Meeting deleted." });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("meetings.edit");
    const { id } = await params;
    const input = await parseBody(req, meetingStatusSchema);

    const service = new MeetingService(session.organizationId);
    const meeting = await service.changeStatus({ userId: session.userId }, id, input);

    return success(meeting, { message: "Meeting status updated." });
  } catch (error) {
    return failure(error);
  }
}
