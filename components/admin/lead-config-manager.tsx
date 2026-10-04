"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Badge } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

interface ConfigRow {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status}).`);
  }
  return json.data as T;
}

/**
 * Custom lead status / source management: add, edit label, activate /
 * deactivate (server blocks deactivation while leads reference the value).
 * DELETE is a safe deactivation, never a hard delete.
 */
export function LeadConfigManager({
  kind,
}: {
  kind: "statuses" | "sources";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const base = `/api/settings/lead-${kind}`;
  const singular = kind === "statuses" ? "status" : "source";
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api<ConfigRow[]>(base, "GET");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load values.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  function openAdd() {
    setEditing(null);
    setKey("");
    setLabel("");
    setModalOpen(true);
  }

  function openEdit(row: ConfigRow) {
    setEditing(row);
    setKey(row.key);
    setLabel(row.label);
    setModalOpen(true);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const cleanKey = key.trim().toLowerCase();
      if (!cleanKey) throw new Error("Enter a key.");
      if (!label.trim()) throw new Error("Enter a label.");
      if (editing) {
        const updated = await api<ConfigRow>(
          `${base}/${encodeURIComponent(editing.key)}`,
          "PATCH",
          { label: label.trim(), isActive: true },
        );
        setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...updated } : r)));
        toast({ variant: "success", title: `${singular} updated.` });
      } else {
        const created = await api<ConfigRow>(base, "POST", {
          key: cleanKey,
          label: label.trim(),
          isActive: true,
        });
        setRows((prev) => [...prev, created]);
        toast({ variant: "success", title: `${singular} added.` });
      }
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not save",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: ConfigRow) {
    if (busy) return;
    setBusy(true);
    try {
      if (row.isActive) {
        if (
          typeof window !== "undefined" &&
          !window.confirm(
            `Deactivate "${row.label}"? This is blocked while leads still use it.`,
          )
        ) {
          return;
        }
        const updated = await api<ConfigRow>(
          `${base}/${encodeURIComponent(row.key)}`,
          "DELETE",
        );
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
        toast({ variant: "success", title: `${singular} deactivated.` });
      } else {
        const updated = await api<ConfigRow>(
          `${base}/${encodeURIComponent(row.key)}`,
          "PATCH",
          { isActive: true },
        );
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
        toast({ variant: "success", title: `${singular} activated.` });
      }
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not change status",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          + Add custom {singular}
        </Button>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      ) : error ? (
        <div className="space-y-2 text-center">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No custom {kind} defined.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Badge variant={r.isActive ? "success" : "neutral"} dot>
                {r.label}
              </Badge>
              <span className="text-xs text-muted-foreground">({r.key})</span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => toggleActive(r)}
                >
                  {r.isActive ? "Deactivate" : "Activate"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${singular}` : `Add custom ${singular}`}
        description={
          editing
            ? "Update the display label."
            : "Keys must be unique and cannot overwrite system values."
        }
        className="max-w-md"
      >
        <div className="space-y-4">
          <FormField label="Key" htmlFor="lead-config-key">
            <Input
              id="lead-config-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={editing !== null}
              placeholder="e.g. nurturing"
              maxLength={64}
            />
          </FormField>
          <FormField label="Label" htmlFor="lead-config-label">
            <Input
              id="lead-config-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Nurturing"
              maxLength={128}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={busy} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
