import { Activity } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { ActivityService } from "@/server/services/activities";
import { ActivityTimeline } from "@/components/operations";
import { ActivityForm } from "@/components/operations";
import { FollowupService } from "@/server/services/followups";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const session = await requireSession();
  const service = new ActivityService(session.organizationId);
  const followupService = new FollowupService(session.organizationId);

  const [{ rows }, reminders] = await Promise.all([
    service.list({
      pagination: { page: 1, pageSize: 50, offset: 0 },
      sort: { column: "occurredAt", order: "desc" },
    }),
    followupService.reminders(session.userId),
  ]);

  const timeline = rows.map((r) => ({
    ...r,
    occurredAt: r.occurredAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities"
        description="Unified timeline of calls, emails, meetings, notes, and follow-ups."
      />

      {reminders.overdue.length > 0 && (
        <div className="rounded-lg border border-warning-bg bg-warning-bg/50 p-4 text-sm text-warning">
          Warning: {reminders.overdue.length} high-priority follow-up
          {reminders.overdue.length > 1 ? "s are" : " is"} overdue.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent activity
              </CardTitle>
              <CardDescription>Latest interactions across your organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={timeline} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Log activity</CardTitle>
              <CardDescription>Record a call, email, note, or meeting.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-up reminders</CardTitle>
              <CardDescription>Today, upcoming, and overdue touchpoints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ReminderGroup label="Today" items={reminders.today} />
              <ReminderGroup label="Upcoming (7 days)" items={reminders.upcoming} />
              <ReminderGroup label="Overdue" items={reminders.overdue} tone="danger" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReminderGroup({
  label,
  items,
  tone = "info",
}: {
  label: string;
  items: Array<{ id: string; actionDescription: string | null; scheduledAt: Date }>;
  tone?: "info" | "danger";
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</p>
        <p className="text-sm text-muted-foreground">None</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{i.actionDescription ?? "Follow-up"}</span>
            <Badge variant={tone === "danger" ? "danger" : "info"}>
              {new Date(i.scheduledAt).toLocaleString()}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
