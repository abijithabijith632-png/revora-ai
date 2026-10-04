import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { LeadForm } from "@/components/leads";
import { LeadConfigService } from "@/server/services/lead-config";

export const metadata = { title: "New Lead" };

export default async function NewLeadPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "leads.create",
  );
  if (!allowed) redirect("/forbidden");
  const config = new LeadConfigService(session.organizationId);
  const [statuses, sources] = await Promise.all([config.listStatuses(), config.listSources()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Lead"
        description="Create a new lead record for your organization."
      />
      <Card>
        <CardHeader>
          <CardTitle>Lead details</CardTitle>
          <CardDescription>
            First and last name are required to create a lead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm
            mode="create"
            customStatuses={statuses.filter((row) => row.isActive).map(({ key, label }) => ({ key, label }))}
            customSources={sources.filter((row) => row.isActive).map(({ key, label }) => ({ key, label }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
