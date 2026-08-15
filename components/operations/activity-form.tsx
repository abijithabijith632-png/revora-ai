"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { ACTIVITY_TYPES } from "@/lib/operations/schemas";
import { activityTypeLabel } from "@/lib/operations/presentation";

/**
 * Log a new activity (call / email / meeting / note / proposal / follow-up /
 * task / payment / status change) into the unified timeline.
 */
export function ActivityForm({
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
  const [type, setType] = useState<string>("call");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      type,
      subject: form.get("subject") as string,
      notes: form.get("notes") as string,
      ...(clientId ? { clientId } : {}),
      ...(opportunityId ? { opportunityId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(contactId ? { contactId } : {}),
    };

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to log activity");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log activity");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <FormField label="Activity type" htmlFor="activity-type" required>
        <Select
          id="activity-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {activityTypeLabel(t)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Subject" htmlFor="activity-subject">
        <Input id="activity-subject" name="subject" placeholder="Summary of activity" />
      </FormField>

      <FormField label="Notes" htmlFor="activity-notes">
        <Textarea id="activity-notes" name="notes" placeholder="Details…" rows={3} />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Log activity"}
        </Button>
      </div>
    </form>
  );
}
