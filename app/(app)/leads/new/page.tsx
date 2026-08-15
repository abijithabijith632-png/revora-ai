import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { LeadForm } from "@/components/leads";

export const metadata = { title: "New Lead" };

export default async function NewLeadPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "leads.create",
  );
  if (!allowed) redirect("/forbidden");

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
          <LeadForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
