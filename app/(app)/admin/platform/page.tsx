import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PlatformService } from "@/server/services/platform";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";

export const metadata = { title: "Platform Administration" };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export default async function PlatformAdminPage() {
  const session = await requireSession();
  const [user] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user?.isPlatformAdmin) redirect("/forbidden");

  const service = new PlatformService();
  const [telemetry, health] = await Promise.all([service.telemetry(), service.health()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Administration"
        description="Aggregate platform metrics and real system health. Separate from organization admin."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <Field label="Total organizations" value={String(telemetry.totalOrganizations)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Field label="Active organizations" value={String(telemetry.activeOrganizations)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Field label="Total users" value={String(telemetry.totalUsers)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Field label="AI requests" value={String(telemetry.aiUsage)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
          <CardDescription>Subscriptions grouped by plan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {telemetry.planDistribution.map((p) => (
            <Badge key={p.plan} variant="info">
              {p.plan}: {p.count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Real checks — no fabricated healthy status.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="API" value={health.checks.api} />
          <Field label="Database" value={health.checks.database} />
          <Field label="AI" value={health.checks.ai} />
          <Field label="Email" value={health.checks.email} />
          <Field label="Payment" value={health.checks.payment} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unavailable Metrics</CardTitle>
          <CardDescription>Cannot be measured with current architecture (explicitly reported, not fabricated).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {telemetry.unavailableMetrics.map((m) => (
            <Badge key={m} variant="neutral">{m}</Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
