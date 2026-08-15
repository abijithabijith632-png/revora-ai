import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MeetingService } from "@/server/services/meetings";
import { MeetingList } from "@/components/operations";
import { parsePagination, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { meetingFilterSchema } from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({
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
  const sort = parseSort(url, ["scheduledAt", "createdAt"] as const, "scheduledAt", "asc");
  const search = parseSearch(url);
  const filters = parseFilters(url, meetingFilterSchema, [
    "status",
    "organizerId",
    "leadId",
  ]);

  const service = new MeetingService(session.organizationId);
  const { rows, total } = await service.list({ pagination, sort, search, filters });

  const serializedRows = rows.map((r) => ({
    ...r,
    scheduledAt: r.scheduledAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Schedule, track, and follow up on meetings."
      />
      <MeetingList
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
