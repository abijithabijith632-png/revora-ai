import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProposalService } from "@/server/services/proposals";
import { ProposalTable } from "@/components/commercial";
import { parsePagination, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { proposalFilterSchema } from "@/lib/commercial/schemas";

export const dynamic = "force-dynamic";

export default async function ProposalsPage({
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
  const sort = parseSort(url, ["createdAt", "amount"] as const, "createdAt", "desc");
  const search = parseSearch(url);
  const filters = parseFilters(url, proposalFilterSchema, [
    "status",
    "opportunityId",
    "clientId",
    "ownerId",
  ]);

  const service = new ProposalService(session.organizationId);
  const { rows, total } = await service.list({ pagination, sort, search, filters });

  const serializedRows = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Track the proposal lifecycle from draft to acceptance."
      />
      <ProposalTable
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
