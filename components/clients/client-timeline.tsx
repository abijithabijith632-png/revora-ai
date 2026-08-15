import { Badge } from "@/components/ui";

/**
 * Client timeline foundation — renders historical lead activities/status
 * events. Phase 11 reuses lead status history + audit-derived events; later
 * phases will append calls, emails, meetings, tasks, etc.
 */

export interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  description?: string | null;
  occurredAt: string;
  actor?: string | null;
}

function typeVariant(type: string): "success" | "info" | "neutral" | "warning" {
  if (type === "converted" || type === "qualified") return "success";
  if (type === "created" || type === "assigned") return "info";
  if (type === "lost" || type === "unqualified") return "warning";
  return "neutral";
}

export function ClientTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No historical activity recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeVariant(e.type)}>{e.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(e.occurredAt).toLocaleString()}
              </span>
            </div>
            {e.description && (
              <p className="mt-1 text-sm text-foreground">{e.description}</p>
            )}
            {e.actor && <p className="text-xs text-faint">By {e.actor}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
