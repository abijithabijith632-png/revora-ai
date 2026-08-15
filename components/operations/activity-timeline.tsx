import { Badge } from "@/components/ui";
import { activityTypeLabel, activityTypeVariant } from "@/lib/operations/presentation";

/**
 * Unified activity timeline — shared by client, opportunity, lead, and contact
 * detail pages. Renders polymorphic activities (calls, emails, meetings, notes,
 * proposals, follow-ups, tasks, status changes) in one chronological feed.
 */

export interface TimelineActivity {
  id: string;
  type: string;
  subject: string | null;
  notes: string | null;
  performedByName: string | null;
  occurredAt: string | Date;
}

export function ActivityTimeline({
  activities,
}: {
  activities: TimelineActivity[];
}) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {activities.map((a) => (
        <li key={a.id} className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activityTypeVariant(a.type)}>
                {activityTypeLabel(a.type)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(a.occurredAt).toLocaleString()}
              </span>
            </div>
            {a.subject && (
              <p className="mt-1 text-sm font-medium text-foreground">{a.subject}</p>
            )}
            {a.notes && (
              <p className="mt-0.5 text-sm text-muted-foreground">{a.notes}</p>
            )}
            {a.performedByName && (
              <p className="mt-1 text-xs text-faint">By {a.performedByName}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
