import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LeadConfigService } from "@/server/services/lead-config";
import { LEAD_SOURCES } from "@/lib/leads/schemas";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";

export const metadata = { title: "Lead Sources" };

export default async function LeadSourcesPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "lead_sources.view");
  if (!allowed) redirect("/forbidden");

  const service = new LeadConfigService(session.organizationId);
  const custom = await service.listSources();

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
          <CardDescription>Tenant-specific sources.</CardDescription>
        </CardHeader>
        <CardContent>
          {custom.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom sources defined.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {custom.map((s) => (
                <Badge key={s.id} variant={s.isActive ? "success" : "neutral"} dot>
                  {s.label} ({s.key})
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
