import { redirect } from "next/navigation";
import { Users, UserCheck, UserX, Target } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LeadService } from "@/server/services/leads";
import { PageHeader, KpiCard, Badge } from "@/components/ui";
import { LeadTable } from "@/components/leads";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "leads.view",
  );
  if (!allowed) redirect("/forbidden");

  const sp = await searchParams;
  const service = new LeadService(session.organizationId);

  const page = Number(sp.page ?? "1") || 1;
  const pageSize = Math.min(Number(sp.pageSize ?? "20") || 20, 100);

  const { rows, total } = await service.list({
    pagination: { page, pageSize, offset: (page - 1) * pageSize },
    sort: {
      column: (sp.sortBy as "createdAt") ?? "createdAt",
      order: sp.sortOrder === "asc" ? "asc" : "desc",
    },
    search: typeof sp.search === "string" ? sp.search : undefined,
    filters: {
      status:
        typeof sp.status === "string" && sp.status ? (sp.status as never) : undefined,
      source:
        typeof sp.source === "string" && sp.source ? (sp.source as never) : undefined,
    },
  });

  const summary = await service.summary();

  const totalPages = Math.ceil(total / pageSize);

  const serializedRows = rows.map((r) => ({
    ...r,
    expectedClosingDate: r.expectedClosingDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Acquire, manage, and track incoming leads."
        actions={
          <Badge variant="info" dot>
            {summary.total} total
          </Badge>
        }
      />

      <section aria-label="Lead summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Leads"
            value={String(summary.total)}
            icon={<Users className="h-4 w-4" />}
            explanation="Active (non-archived) leads in your organization."
          />
          <KpiCard
            title="Qualified"
            value={String(summary.byStatus.qualified ?? 0)}
            icon={<UserCheck className="h-4 w-4" />}
            tone="success"
            explanation="Leads currently marked as qualified."
          />
          <KpiCard
            title="Unqualified"
            value={String(summary.byStatus.unqualified ?? 0)}
            icon={<UserX className="h-4 w-4" />}
            tone="danger"
            explanation="Leads currently marked as unqualified."
          />
          <KpiCard
            title="Converted"
            value={String(summary.byStatus.converted ?? 0)}
            icon={<Target className="h-4 w-4" />}
            tone="success"
            explanation="Leads that have been converted to clients."
          />
        </div>
      </section>

      <LeadTable
        initialRows={serializedRows}
        initialMeta={{ page, pageSize, total, totalPages }}
      />
    </div>
  );
}
