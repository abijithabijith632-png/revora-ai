import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { FollowupService } from "@/server/services/followups";
import {
  updateFollowupSchema,
  followupStatusSchema,
} from "@/lib/operations/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("activities.view");
    const { id } = await params;

    const service = new FollowupService(session.organizationId);
    const followup = await service.getById(id);

    return success(followup, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("activities.edit");
    const { id } = await params;
    const input = await parseBody(req, updateFollowupSchema);

    const service = new FollowupService(session.organizationId);
    const followup = await service.update({ userId: session.userId }, id, input);

    return success(followup, { message: "Follow-up updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("activities.delete");
    const { id } = await params;

    const service = new FollowupService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Follow-up cancelled." });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("activities.edit");
    const { id } = await params;
    const input = await parseBody(req, followupStatusSchema);

    const service = new FollowupService(session.organizationId);
    const followup = await service.changeStatus({ userId: session.userId }, id, input);

    return success(followup, { message: "Follow-up status updated." });
  } catch (error) {
    return failure(error);
  }
}
