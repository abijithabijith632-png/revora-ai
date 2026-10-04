import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { MeetingService } from "@/server/services/meetings";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import { MeetingDetailActions } from "@/components/operations";
import { MeetingSummaryButton } from "@/components/ai/meeting-summary-button";
import { NotFoundError } from "@/lib/errors";
import {
  meetingStatusLabel,
  meetingStatusVariant,
} from "@/lib/operations/presentation";

export const metadata = { title: "Meeting Detail" };
export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "meetings.view",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new MeetingService(session.organizationId);
  let meeting;
  try {
    meeting = await service.getById(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={meeting.title}
        description={`Scheduled for ${new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(meeting.scheduledAt)} UTC`}
        actions={
          <Link
            href="/meetings"
            className="inline-flex h-8 items-center rounded-md border border-border-strong bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-surface-subtle"
          >
            Back to meetings
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={meetingStatusVariant(meeting.status)} dot>
          {meetingStatusLabel(meeting.status)}
        </Badge>
        {meeting.virtualLink ? (
          <a
            href={meeting.virtualLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Join meeting
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Schedule, organizer, and agenda.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Organizer" value={meeting.organizerName} />
              <Field
                label="Duration"
                value={
                  meeting.durationMinutes != null
                    ? `${meeting.durationMinutes} minutes`
                    : null
                }
              />
              <Field label="Description" value={meeting.description} />
              <Field label="Agenda" value={meeting.agenda} />
              <Field label="Notes" value={meeting.notes} />
              <Field label="Outcome" value={meeting.outcome} />
            </CardContent>
          </Card>

          {meeting.participants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {meeting.participants.map((p) => (
                    <li key={p.id}>
                      {p.contactName ?? p.userName ?? "Unknown"} ·{" "}
                      {p.participantType}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>AI summary</CardTitle>
              <CardDescription>
                Summarize the saved notes for this meeting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MeetingSummaryButton meetingId={meeting.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage</CardTitle>
              <CardDescription>Change status or delete.</CardDescription>
            </CardHeader>
            <CardContent>
              <MeetingDetailActions
                meetingId={meeting.id}
                currentStatus={meeting.status}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
        {value ?? "—"}
      </p>
    </div>
  );
}
