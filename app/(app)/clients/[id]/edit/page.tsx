import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ClientService } from "@/server/services/clients";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/clients";

export const metadata = { title: "Edit Client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "clients.edit",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new ClientService(session.organizationId);
  const client = await service.getById(id).catch(() => null);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Client" description={client.companyName} />
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>Update the company information for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm
            mode="edit"
            clientId={client.id}
            initial={{
              companyName: client.companyName,
              industry: client.industry ?? "",
              companySize: client.companySize ?? "",
              corporateInfo: client.corporateInfo ?? "",
              address: client.address ?? "",
              billingAddress: client.billingAddress ?? "",
              website: client.website ?? "",
              customerSince: client.customerSince?.toISOString().slice(0, 10) ?? "",
              status: client.status,
              notes: client.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
