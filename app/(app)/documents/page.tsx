import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DocumentService } from "@/server/services/documents";
import { DocumentList } from "@/components/commercial";
import { parsePagination, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { documentFilterSchema } from "@/lib/commercial/schemas";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
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
  const sort = parseSort(url, ["name", "createdAt"] as const, "createdAt", "desc");
  const search = parseSearch(url);
  const filters = parseFilters(url, documentFilterSchema, [
    "documentType",
    "clientId",
    "opportunityId",
    "status",
  ]);

  const service = new DocumentService(session.organizationId);
  const { rows, total } = await service.list({ pagination, sort, search, filters });

  const serializedRows = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Centralized client document repository with access governance."
      />
      <DocumentList
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
