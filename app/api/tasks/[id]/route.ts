import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { TaskService } from "@/server/services/tasks";
import { updateTaskSchema } from "@/lib/operations/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("tasks.view");
    const { id } = await params;

    const service = new TaskService(session.organizationId);
    const task = await service.getById(id);

    return success(task, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("tasks.edit");
    const { id } = await params;
    const input = await parseBody(req, updateTaskSchema);

    const service = new TaskService(session.organizationId);
    const task = await service.update({ userId: session.userId }, id, input);

    return success(task, { message: "Task updated." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("tasks.delete");
    const { id } = await params;

    const service = new TaskService(session.organizationId);
    const result = await service.archive({ userId: session.userId }, id);

    return success(result, { message: "Task archived." });
  } catch (error) {
    return failure(error);
  }
}
