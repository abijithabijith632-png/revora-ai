"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/operations/schemas";
import {
  taskPriorityLabel,
  taskStatusLabel,
} from "@/lib/operations/presentation";

export interface TaskDetailInitial {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
}

/**
 * Task detail editor. Loads with server-provided values, saves via the
 * existing PATCH /api/tasks/[id] endpoint and deletes via DELETE, so task
 * data round-trips through the validated API contracts.
 */
export function TaskDetail({ initial }: { initial: TaskDetailInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [priority, setPriority] = useState(initial.priority);
  const [status, setStatus] = useState(initial.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate.trim() || undefined,
          priority,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not save task.");
      }
      toast({ variant: "success", title: "Task updated." });
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not save task",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete() {
    if (completing) return;
    setCompleting(true);
    const next = status === "completed" ? "pending" : "completed";
    try {
      const res = await fetch(`/api/tasks/${initial.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not update task.");
      }
      setStatus(next);
      toast({ variant: "success", title: "Task status updated." });
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not update task",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCompleting(false);
    }
  }

  async function remove() {
    if (deleting) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this task? This cannot be undone.")
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${initial.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not delete task.");
      }
      toast({ variant: "success", title: "Task deleted." });
      router.push("/tasks");
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not delete task",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <FormField label="Title" htmlFor="task-detail-title" required>
        <Input
          id="task-detail-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Description" htmlFor="task-detail-description">
        <Textarea
          id="task-detail-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Due date" htmlFor="task-detail-due">
          <Input
            id="task-detail-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>
        <FormField label="Priority" htmlFor="task-detail-priority">
          <Select
            id="task-detail-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {taskPriorityLabel(p)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="task-detail-status">
          <Select
            id="task-detail-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {taskStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={completing}
          disabled={completing}
          onClick={toggleComplete}
        >
          Toggle complete
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={deleting}
          disabled={deleting}
          onClick={remove}
        >
          Delete
        </Button>
        <Button type="submit" loading={saving} disabled={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
