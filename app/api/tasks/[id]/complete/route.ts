import { NextRequest } from "next/server";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { TaskService } from "@/server/services/tasks";
import { taskStatusSchema } from "@/lib/operations/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiContext("tasks.edit");
    const { id } = await params;
    const input = await parseBody(req, taskStatusSchema);

    const service = new TaskService(session.organizationId);
    const task = await service.complete({ userId: session.userId }, id, input);

    return success(task, { message: "Task status updated." });
  } catch (error) {
    return failure(error);
  }
}
