"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { MEETING_STATUSES } from "@/lib/operations/schemas";
import { meetingStatusLabel } from "@/lib/operations/presentation";

export function MeetingForm({ leadId }: { leadId?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const duration = form.get("durationMinutes") as string;
    const payload = {
      title: form.get("title") as string,
      description: form.get("description") as string,
      scheduledAt: new Date(form.get("scheduledAt") as string).toISOString(),
      ...(duration ? { durationMinutes: Number(duration) } : {}),
      virtualLink: form.get("virtualLink") as string,
      agenda: form.get("agenda") as string,
      status: form.get("status") as string,
      ...(leadId ? { leadId } : {}),
    };

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to schedule meeting");
      router.push("/meetings");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <FormField label="Title" htmlFor="meeting-title" required>
        <Input id="meeting-title" name="title" placeholder="Meeting title" required />
      </FormField>

      <FormField label="Description" htmlFor="meeting-description">
        <Textarea id="meeting-description" name="description" rows={2} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Scheduled date & time" htmlFor="meeting-when" required>
          <Input id="meeting-when" name="scheduledAt" type="datetime-local" required />
        </FormField>
        <FormField label="Duration (minutes)" htmlFor="meeting-duration">
          <Input id="meeting-duration" name="durationMinutes" type="number" min={1} />
        </FormField>
        <FormField label="Status" htmlFor="meeting-status">
          <Select id="meeting-status" name="status" defaultValue="scheduled">
            {MEETING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {meetingStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Virtual meeting link" htmlFor="meeting-link">
        <Input id="meeting-link" name="virtualLink" type="url" placeholder="https://…" />
      </FormField>

      <FormField label="Agenda" htmlFor="meeting-agenda">
        <Textarea id="meeting-agenda" name="agenda" rows={3} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Schedule meeting"}
        </Button>
      </div>
    </form>
  );
}
