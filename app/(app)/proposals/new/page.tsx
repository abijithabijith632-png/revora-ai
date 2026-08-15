import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { ProposalForm } from "@/components/commercial";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader title="New Proposal" description="Create a proposal for an opportunity." />
      <Card>
        <CardContent className="pt-6">
          <ProposalForm />
        </CardContent>
      </Card>
    </div>
  );
}
