"use client";

import { Badge } from "@/components/ui";
import { statusLabel, statusVariant } from "@/lib/leads/presentation";
import type { LeadStatusHistoryItem } from "@/lib/leads/types";

/**
 * Status history timeline — read-only, data comes from the server page.
 */

export function LeadStatusHistory({
  history,
}: {
  history: LeadStatusHistoryItem[];
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No status changes recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {history.map((h) => (
        <li key={h.id} className="relative flex gap-3 pl-5">
          <span
            aria-hidden="true"
            className="absolute left-0 top-2 h-2 w-2 rounded-full bg-faint"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(h.toStatus)} dot>
                {statusLabel(h.toStatus)}
              </Badge>
              {h.fromStatus && (
                <span className="text-xs text-muted-foreground">
                  from {statusLabel(h.fromStatus)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {h.changedByName ?? "System"} ·{" "}
              {new Date(h.changedAt).toLocaleString()}
            </p>
            {h.notes && <p className="mt-1 text-sm">{h.notes}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
