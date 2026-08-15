import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ClientService } from "@/server/services/clients";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { OpportunityForm } from "@/components/opportunities";

export const metadata = { title: "New Opportunity" };

export default async function NewOpportunityPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "opportunities.create",
  );
  if (!allowed) redirect("/forbidden");

  const clientService = new ClientService(session.organizationId);
  const { rows } = await clientService.list({
    pagination: { page: 1, pageSize: 1000, offset: 0 },
    sort: { column: "companyName", order: "asc" },
  });
  const clients = rows.map((c) => ({ id: c.id, companyName: c.companyName }));

  return (
    <div className="space-y-6">
      <PageHeader title="New Opportunity" description="Create a new sales opportunity." />
      <Card>
        <CardHeader>
          <CardTitle>Opportunity details</CardTitle>
          <CardDescription>Enter the deal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <OpportunityForm mode="create" clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
