"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  displayAt: string;
  metadata: unknown;
  previousValue: unknown;
  newValue: unknown;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Detailed audit event view: entity id, previous/new values, metadata. */
export function AuditEventDetail({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Details
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${event.action} · ${event.entityType}`}
        description={`${event.actorName ?? "System"} · ${event.displayAt}`}
        className="max-w-lg"
      >
        <dl className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Entity ID</dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {event.entityId ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Previous value</dt>
            <dd className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
              {renderValue(event.previousValue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">New value</dt>
            <dd className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
              {renderValue(event.newValue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Metadata</dt>
            <dd className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
              {renderValue(event.metadata)}
            </dd>
          </div>
        </dl>
      </Modal>
    </>
  );
}
