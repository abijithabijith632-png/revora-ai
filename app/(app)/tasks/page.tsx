import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TaskService } from "@/server/services/tasks";
import { TaskList } from "@/components/operations";
import { parsePagination, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { taskFilterSchema } from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const url = new URL("https://local");
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") url.searchParams.set(k, v);
  }

  const pagination = parsePagination(url);
  const sort = parseSort(url, ["dueDate", "priority", "createdAt"] as const, "createdAt", "desc");
  const search = parseSearch(url);
  const filters = parseFilters(url, taskFilterSchema, [
    "status",
    "priority",
    "assignedTo",
    "clientId",
    "opportunityId",
  ]);

  const service = new TaskService(session.organizationId);
  const { rows, total } = await service.list({ pagination, sort, search, filters });

  const serializedRows = rows.map((r) => ({
    ...r,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Create, assign, and track actionable tasks across your team."
      />
      <TaskList
        initialRows={serializedRows}
        initialMeta={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total,
          totalPages: Math.ceil(total / pagination.pageSize),
        }}
      />
    </div>
  );
}
