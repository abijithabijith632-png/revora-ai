import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LeadService } from "@/server/services/leads";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { LeadForm } from "@/components/leads";

export const metadata = { title: "Edit Lead" };

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "leads.edit",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new LeadService(session.organizationId);
  const lead = await service.getById(id).catch(() => null);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Lead"
        description={lead.fullName}
      />
      <Card>
        <CardHeader>
          <CardTitle>Lead details</CardTitle>
          <CardDescription>
            Update the lead information below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm
            mode="edit"
            leadId={lead.id}
            initial={{
              firstName: lead.firstName ?? lead.fullName,
              lastName: lead.lastName ?? "",
              email: lead.email ?? "",
              phone: lead.phone ?? "",
              alternatePhone: lead.alternatePhone ?? "",
              companyName: lead.companyName ?? "",
              industry: lead.industry ?? "",
              companySize: lead.companySize ?? "",
              geography: lead.geography ?? "",
              website: lead.website ?? "",
              source: lead.source,
              status: lead.status,
              budget: lead.budget != null ? String(lead.budget) : "",
              expectedClosingDate: lead.expectedClosingDate?.toISOString().slice(0, 10) ?? "",
              interestedProduct: lead.interestedProduct ?? "",
              notes: lead.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
