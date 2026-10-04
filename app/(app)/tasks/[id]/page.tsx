import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { TaskService } from "@/server/services/tasks";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import { TaskDetail } from "@/components/operations";
import {
  taskPriorityVariant,
  taskStatusLabel,
  taskStatusVariant,
  TASK_PRIORITY_LABELS,
} from "@/lib/operations/presentation";

export const metadata = { title: "Task Detail" };
export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "tasks.view",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new TaskService(session.organizationId);
  const task = await service.getById(id).catch(() => null);
  if (!task) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description="Task details and editing."
        actions={
          <Link
            href="/tasks"
            className="inline-flex h-8 items-center rounded-md border border-border-strong bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-surface-subtle"
          >
            Back to tasks
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={taskStatusVariant(task.status)}>
          {taskStatusLabel(task.status)}
        </Badge>
        <Badge variant={taskPriorityVariant(task.priority)}>
          {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit task</CardTitle>
          <CardDescription>
            Changes save through the validated task API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskDetail
            initial={{
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate
                ? task.dueDate.toISOString().slice(0, 10)
                : null,
              priority: task.priority,
              status: task.status,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
