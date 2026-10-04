import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LEAD_STATUSES } from "@/lib/leads/schemas";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { LeadConfigManager } from "@/components/admin/lead-config-manager";

export const metadata = { title: "Lead Statuses" };

export default async function LeadStatusesPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "lead_statuses.view");
  if (!allowed) redirect("/forbidden");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Statuses"
        description="System statuses plus tenant-defined custom statuses."
      />

      <Card>
        <CardHeader>
          <CardTitle>System Statuses</CardTitle>
          <CardDescription>Canonical statuses available to all organizations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LEAD_STATUSES.map((s) => (
            <Badge key={s} variant="info">{s}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Statuses</CardTitle>
          <CardDescription>
            Tenant-specific statuses. Deactivating a status is blocked while leads still reference it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadConfigManager kind="statuses" />
        </CardContent>
      </Card>
    </div>
  );
}
