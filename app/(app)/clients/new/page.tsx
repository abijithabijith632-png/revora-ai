import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/clients";

export const metadata = { title: "New Client" };

export default async function NewClientPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "clients.create",
  );
  if (!allowed) redirect("/forbidden");

  return (
    <div className="space-y-6">
      <PageHeader title="New Client" description="Create a new client account." />
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>Enter the company information for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
