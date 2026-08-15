"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/operations/schemas";
import { taskPriorityLabel, taskStatusLabel } from "@/lib/operations/presentation";

export function TaskForm({
  clientId,
  opportunityId,
  leadId,
}: {
  clientId?: string;
  opportunityId?: string;
  leadId?: string;
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
      title: form.get("title") as string,
      description: form.get("description") as string,
      dueDate: form.get("dueDate") as string,
      priority: form.get("priority") as string,
      status: form.get("status") as string,
      ...(clientId ? { clientId } : {}),
      ...(opportunityId ? { opportunityId } : {}),
      ...(leadId ? { leadId } : {}),
    };

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to create task");
      router.push("/tasks");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <FormField label="Title" htmlFor="task-title" required>
        <Input id="task-title" name="title" placeholder="Task title" required />
      </FormField>

      <FormField label="Description" htmlFor="task-description">
        <Textarea id="task-description" name="description" rows={3} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Due date" htmlFor="task-due">
          <Input id="task-due" name="dueDate" type="date" />
        </FormField>
        <FormField label="Priority" htmlFor="task-priority">
          <Select id="task-priority" name="priority" defaultValue="medium">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {taskPriorityLabel(p)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="task-status">
          <Select id="task-status" name="status" defaultValue="pending">
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {taskStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
