import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { OpportunityService } from "@/server/services/opportunities";
import { PageHeader, KpiCard } from "@/components/ui";
import { OpportunityTable } from "@/components/opportunities";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "opportunities.view",
  );
  if (!allowed) redirect("/forbidden");

  const sp = await searchParams;
  const service = new OpportunityService(session.organizationId);

  const page = Number(sp.page ?? "1") || 1;
  const pageSize = Math.min(Number(sp.pageSize ?? "20") || 20, 100);

  const { rows, total } = await service.list({
    pagination: { page, pageSize, offset: (page - 1) * pageSize },
    sort: { column: "createdAt", order: "desc" },
    search: typeof sp.search === "string" ? sp.search : undefined,
    filters: {
      stageKey:
        typeof sp.stageKey === "string" && sp.stageKey
          ? (sp.stageKey as never)
          : undefined,
    },
  });

  const { totals } = await service.pipelineSummary();
  const totalPages = Math.ceil(total / pageSize);

  const serializedRows = rows.map((r) => ({
    ...r,
    stageKey: r.stageKey,
    expectedCloseDate: r.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunities"
        description="Track sales opportunities and deals."
      />

      <section aria-label="Opportunity summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Opportunities"
            value={String(totals.count)}
            icon={<Target className="h-4 w-4" />}
          />
          <KpiCard
            title="Total Pipeline"
            value={formatMoney(totals.totalValue)}
            icon={<Target className="h-4 w-4" />}
          />
          <KpiCard
            title="Weighted Pipeline"
            value={formatMoney(Number(totals.weightedValue))}
            icon={<Target className="h-4 w-4" />}
            tone="success"
          />
          <KpiCard
            title="Won"
            value={formatMoney(totals.wonValue)}
            icon={<Target className="h-4 w-4" />}
            tone="success"
          />
        </div>
      </section>

      <OpportunityTable
        initialRows={serializedRows}
        initialMeta={{ page, pageSize, total, totalPages }}
      />
    </div>
  );
}
