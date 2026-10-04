import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { ProposalForm } from "@/components/commercial";
import { OpportunityService } from "@/server/services/opportunities";
import { ClientService } from "@/server/services/clients";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  const session = await requireSession();

  const opportunityService = new OpportunityService(session.organizationId);
  const clientService = new ClientService(session.organizationId);
  const [{ rows: opportunities }, clients] = await Promise.all([
    opportunityService.list({
      pagination: { page: 1, pageSize: 100, offset: 0 },
      sort: { column: "createdAt", order: "desc" },
    }),
    clientService.list({
      pagination: { page: 1, pageSize: 100, offset: 0 },
      sort: { column: "createdAt", order: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="New Proposal" description="Create a proposal for an opportunity." />
      <Card>
        <CardContent className="pt-6">
          <ProposalForm
            opportunities={opportunities.map((o) => ({
              id: o.id,
              name: `${o.name} (${o.opportunityNumber})`,
            }))}
            clients={clients.rows.map((c) => ({
              id: c.id,
              name: c.companyName,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
