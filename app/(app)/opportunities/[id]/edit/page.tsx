import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { OpportunityService } from "@/server/services/opportunities";
import { ClientService } from "@/server/services/clients";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { OpportunityForm } from "@/components/opportunities";

export const metadata = { title: "Edit Opportunity" };

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "opportunities.edit",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new OpportunityService(session.organizationId);
  const opp = await service.getById(id).catch(() => null);
  if (!opp) notFound();

  const clientService = new ClientService(session.organizationId);
  const { rows } = await clientService.list({
    pagination: { page: 1, pageSize: 1000, offset: 0 },
    sort: { column: "companyName", order: "asc" },
  });
  const clients = rows.map((c) => ({ id: c.id, companyName: c.companyName }));

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Opportunity" description={opp.name} />
      <Card>
        <CardHeader>
          <CardTitle>Opportunity details</CardTitle>
          <CardDescription>Update the deal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <OpportunityForm
            mode="edit"
            opportunityId={opp.id}
            clients={clients}
            initial={{
              name: opp.name,
              clientId: opp.clientId,
              ownerId: opp.ownerId ?? "",
              amount: opp.amount != null ? String(opp.amount) : "",
              probability: opp.probability != null ? String(opp.probability) : "",
              expectedCloseDate:
                opp.expectedCloseDate?.toISOString().slice(0, 10) ?? "",
              stageKey: opp.stageKey ?? "new",
              source: opp.source ?? "website",
              productService: opp.productService ?? "",
              description: opp.description ?? "",
              notes: opp.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
