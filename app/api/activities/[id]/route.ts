import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ActivityService } from "@/server/services/activities";
import { updateActivitySchema } from "@/lib/operations/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("activities.view");
    const { id } = await params;

    const service = new ActivityService(session.organizationId);
    const activity = await service.getById(id);

    return success(activity, { message: "OK" });
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
    const input = await parseBody(req, updateActivitySchema);

    const service = new ActivityService(session.organizationId);
    const activity = await service.update({ userId: session.userId }, id, input);

    return success(activity, { message: "Activity updated." });
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

    const service = new ActivityService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Activity deleted." });
  } catch (error) {
    return failure(error);
  }
}
