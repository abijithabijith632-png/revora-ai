"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import {
  FOLLOWUP_CHANNELS,
  FOLLOWUP_STATUSES,
  TASK_PRIORITIES,
} from "@/lib/operations/schemas";
import {
  followupChannelLabel,
  followupStatusLabel,
  taskPriorityLabel,
} from "@/lib/operations/presentation";

export function FollowupForm({
  clientId,
  opportunityId,
  leadId,
  contactId,
}: {
  clientId?: string;
  opportunityId?: string;
  leadId?: string;
  contactId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      clientId,
      ...(opportunityId ? { opportunityId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(contactId ? { contactId } : {}),
      channel: form.get("channel") as string,
      scheduledAt: new Date(form.get("scheduledAt") as string).toISOString(),
      priority: form.get("priority") as string,
      status: form.get("status") as string,
      actionDescription: form.get("actionDescription") as string,
      notes: form.get("notes") as string,
    };

    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to schedule follow-up");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule follow-up");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <FormField label="Action description" htmlFor="fu-action" required>
        <Textarea
          id="fu-action"
          name="actionDescription"
          placeholder="What needs to happen…"
          rows={2}
          required
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Channel" htmlFor="fu-channel">
          <Select id="fu-channel" name="channel" defaultValue="email">
            {FOLLOWUP_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {followupChannelLabel(c)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Priority" htmlFor="fu-priority">
          <Select id="fu-priority" name="priority" defaultValue="medium">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {taskPriorityLabel(p)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="fu-status">
          <Select id="fu-status" name="status" defaultValue="pending">
            {FOLLOWUP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {followupStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Scheduled date & time" htmlFor="fu-when" required>
        <Input id="fu-when" name="scheduledAt" type="datetime-local" required />
      </FormField>

      <FormField label="Notes" htmlFor="fu-notes">
        <Textarea id="fu-notes" name="notes" rows={3} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Schedule follow-up"}
        </Button>
      </div>
    </form>
  );
}
