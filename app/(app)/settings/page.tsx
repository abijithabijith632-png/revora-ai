import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { OrganizationSettingsService } from "@/server/services/organization-settings";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";
import { OrganizationForm } from "@/components/admin/organization-form";

export const metadata = { title: "Organization Settings" };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "settings.view");
  if (!allowed) redirect("/forbidden");

  const service = new OrganizationSettingsService(session.organizationId);
  const [{ profile, settings }, usage] = await Promise.all([
    service.getProfile(),
    service.usage(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Settings"
        description="Company profile, currency, timezone, and workspace preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>Identity and contact information for your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm
            initial={{
              name: profile.name,
              industry: profile.industry,
              website: profile.website,
              contactEmail: profile.contactEmail,
              contactPhone: profile.contactPhone,
              address: profile.address,
              description: profile.description,
              logoUrl: profile.logoUrl,
              currency: settings?.currency ?? profile.currency,
              timezone: settings?.timezone ?? profile.timezone,
              dateFormat: settings?.dateFormat ?? "MMM d, yyyy",
            }}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Regional Preferences</CardTitle>
            <CardDescription>Base currency and timezone.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Currency" value={`${settings?.currency ?? profile.currency} (${formatMoney(12345, settings?.currency ?? profile.currency)})`} />
            <Field label="Timezone" value={settings?.timezone ?? profile.timezone} />
            <Field label="Date format" value={settings?.dateFormat ?? "MMM d, yyyy"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Real-data usage snapshot for this organization.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Users" value={String(usage.users)} />
            <Field label="Leads" value={String(usage.leads)} />
            <Field label="AI requests" value={String(usage.aiRequests)} />
            <Field label="Documents" value={String(usage.documents)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Organization Status
            <Badge variant={profile.status === "active" ? "success" : "warning"} dot>
              {profile.status}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
