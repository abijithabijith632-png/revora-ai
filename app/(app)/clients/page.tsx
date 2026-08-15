import { redirect } from "next/navigation";
import { Building2, Star, UserX } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ClientService } from "@/server/services/clients";
import { PageHeader, KpiCard } from "@/components/ui";
import { ClientTable } from "@/components/clients";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "clients.view",
  );
  if (!allowed) redirect("/forbidden");

  const sp = await searchParams;
  const service = new ClientService(session.organizationId);

  const page = Number(sp.page ?? "1") || 1;
  const pageSize = Math.min(Number(sp.pageSize ?? "20") || 20, 100);

  const { rows, total } = await service.list({
    pagination: { page, pageSize, offset: (page - 1) * pageSize },
    sort: { column: "createdAt", order: "desc" },
    search: typeof sp.search === "string" ? sp.search : undefined,
    filters: {
      status: typeof sp.status === "string" && sp.status ? (sp.status as never) : undefined,
    },
  });

  const summary = await service.summary();
  const totalPages = Math.ceil(total / pageSize);

  const serializedRows = rows.map((r) => ({
    ...r,
    customerSince: r.customerSince?.toISOString().slice(0, 10) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage your client accounts and relationships."
      />

      <section aria-label="Client summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Clients"
            value={String(summary.total)}
            icon={<Building2 className="h-4 w-4" />}
            explanation="Active (non-archived) client accounts."
          />
          <KpiCard
            title="Active"
            value={String(summary.byStatus.active ?? 0)}
            icon={<Building2 className="h-4 w-4" />}
            tone="success"
            explanation="Clients with an active relationship."
          />
          <KpiCard
            title="VIP"
            value={String(summary.byStatus.vip ?? 0)}
            icon={<Star className="h-4 w-4" />}
            tone="success"
            explanation="High-value VIP clients."
          />
          <KpiCard
            title="Churned / Inactive"
            value={String((summary.byStatus.churned ?? 0) + (summary.byStatus.inactive ?? 0))}
            icon={<UserX className="h-4 w-4" />}
            tone="danger"
            explanation="Clients that have churned or are inactive."
          />
        </div>
      </section>

      <ClientTable
        initialRows={serializedRows}
        initialMeta={{ page, pageSize, total, totalPages }}
      />
    </div>
  );
}
