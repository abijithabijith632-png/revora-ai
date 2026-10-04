"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { MEETING_STATUSES } from "@/lib/operations/schemas";
import { meetingStatusLabel } from "@/lib/operations/presentation";

/**
 * Status change + delete actions for the meeting detail page. Uses the
 * existing PATCH / DELETE / POST /api/meetings/[id] endpoints so behavior
 * matches the API contracts (auth, tenant isolation, validation).
 */
export function MeetingDetailActions({
  meetingId,
  currentStatus,
}: {
  meetingId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveStatus() {
    if (status === currentStatus || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not update meeting.");
      }
      toast({ variant: "success", title: "Meeting updated." });
      router.refresh();
    } catch (err) {
      setStatus(currentStatus);
      toast({
        variant: "error",
        title: "Could not update meeting",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (deleting) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this meeting? This cannot be undone.")
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not delete meeting.");
      }
      toast({ variant: "success", title: "Meeting deleted." });
      router.push("/meetings");
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not delete meeting",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <FormField label="Status" htmlFor="meeting-detail-status">
          <Select
            id="meeting-detail-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {MEETING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {meetingStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <Button
        type="button"
        size="sm"
        loading={busy}
        disabled={busy || status === currentStatus}
        onClick={saveStatus}
      >
        Save status
      </Button>
      <Button
        type="button"
        size="sm"
        variant="danger"
        loading={deleting}
        disabled={deleting}
        onClick={remove}
      >
        Delete
      </Button>
    </div>
  );
}
