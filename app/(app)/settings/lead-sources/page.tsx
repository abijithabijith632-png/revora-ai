import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LEAD_SOURCES } from "@/lib/leads/schemas";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { LeadConfigManager } from "@/components/admin/lead-config-manager";

export const metadata = { title: "Lead Sources" };

export default async function LeadSourcesPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "lead_sources.view");
  if (!allowed) redirect("/forbidden");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Sources"
        description="System sources plus tenant-defined custom sources."
      />

      <Card>
        <CardHeader>
          <CardTitle>System Sources</CardTitle>
          <CardDescription>Canonical sources available to all organizations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LEAD_SOURCES.map((s) => (
            <Badge key={s} variant="info">{s}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Sources</CardTitle>
          <CardDescription>
            Tenant-specific sources. Deletion is a safe deactivation, blocked while leads still reference the source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadConfigManager kind="sources" />
        </CardContent>
      </Card>
    </div>
  );
}
