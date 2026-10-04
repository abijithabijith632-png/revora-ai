"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Badge } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export interface StageRow {
  id: string;
  key: string;
  name: string;
  orderIndex: number;
  probability: number | null;
  isActive: boolean;
  isTerminal: boolean;
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
 * Pipeline stage management: add, edit (name/probability/order/active),
 * and reorder. All writes go through the existing validated pipeline-stages
 * API; deactivation stays blocked server-side while open opportunities
 * reference a stage.
 */
export function PipelineStageManager({ initial }: { initial: StageRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [stages, setStages] = useState<StageRow[]>(() =>
    [...initial].sort((a, b) => a.orderIndex - b.orderIndex),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StageRow | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [probability, setProbability] = useState("50");
  const [orderIndex, setOrderIndex] = useState("0");
  const [isTerminal, setIsTerminal] = useState(false);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setName("");
    setKey("");
    setProbability("50");
    setOrderIndex(String(stages.length));
    setIsTerminal(false);
    setModalOpen(true);
  }

  function openEdit(row: StageRow) {
    setEditing(row);
    setName(row.name);
    setKey(row.key);
    setProbability(row.probability === null ? "" : String(row.probability));
    setOrderIndex(String(row.orderIndex));
    setIsTerminal(row.isTerminal);
    setModalOpen(true);
  }

  function resort(rows: StageRow[]): StageRow[] {
    return [...rows].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const cleanName = name.trim();
      if (!cleanName) throw new Error("Stage name is required.");
      const prob = probability.trim() === "" ? null : Number(probability);
      if (prob !== null && (!Number.isInteger(prob) || prob < 0 || prob > 100)) {
        throw new Error("Probability must be an integer between 0 and 100.");
      }
      const order = Number(orderIndex);
      if (!Number.isInteger(order) || order < 0) {
        throw new Error("Order must be a non-negative integer.");
      }
      if (editing) {
        const updated = await api<StageRow>(
          `/api/settings/pipeline-stages/${editing.id}`,
          "PATCH",
          { name: cleanName, orderIndex: order, probability: prob },
        );
        setStages((prev) => resort(prev.map((s) => (s.id === editing.id ? { ...s, ...updated } : s))));
        toast({ variant: "success", title: "Stage updated." });
      } else {
        const cleanKey = key.trim().toLowerCase();
        if (!cleanKey) throw new Error("Stage key is required.");
        const created = await api<StageRow>("/api/settings/pipeline-stages", "POST", {
          name: cleanName,
          key: cleanKey,
          orderIndex: order,
          probability: prob,
          isActive: true,
          isTerminal,
        });
        setStages((prev) => resort([...prev, created]));
        toast({ variant: "success", title: "Stage added." });
      }
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not save stage",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: StageRow) {
    if (busy) return;
    setBusy(true);
    try {
      if (row.isActive && typeof window !== "undefined") {
        const ok = window.confirm(
          `Deactivate "${row.name}"? This is blocked while open opportunities reference it.`,
        );
        if (!ok) return;
      }
      const updated = await api<StageRow>(
        `/api/settings/pipeline-stages/${row.id}`,
        "PATCH",
        { isActive: !row.isActive },
      );
      setStages((prev) => resort(prev.map((s) => (s.id === row.id ? { ...s, ...updated } : s))));
      toast({
        variant: "success",
        title: row.isActive ? "Stage deactivated." : "Stage activated.",
      });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not change stage state",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function move(row: StageRow, direction: -1 | 1) {
    if (busy) return;
    const ordered = resort(stages);
    const idx = ordered.findIndex((s) => s.id === row.id);
    const other = ordered[idx + direction];
    if (!other) return;
    setBusy(true);
    try {
      const [a, b] = await Promise.all([
        api<StageRow>(`/api/settings/pipeline-stages/${row.id}`, "PATCH", {
          orderIndex: other.orderIndex,
        }),
        api<StageRow>(`/api/settings/pipeline-stages/${other.id}`, "PATCH", {
          orderIndex: row.orderIndex,
        }),
      ]);
      setStages((prev) =>
        resort(prev.map((s) => (s.id === row.id ? { ...s, ...a } : s.id === other.id ? { ...s, ...b } : s))),
      );
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not reorder",
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
          + Add stage
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {stages.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="w-10 text-sm text-muted-foreground">#{s.orderIndex}</span>
            <span className="font-medium text-foreground">{s.name}</span>
            <span className="text-xs text-muted-foreground">({s.key})</span>
            <span className="text-xs text-muted-foreground">
              {s.probability === null ? "—" : `${s.probability}%`}
            </span>
            {s.isTerminal && <Badge variant="warning">Terminal</Badge>}
            <Badge variant={s.isActive ? "success" : "neutral"} dot>
              {s.isActive ? "Active" : "Inactive"}
            </Badge>
            <span className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || i === 0}
                onClick={() => move(s, -1)}
                aria-label={`Move ${s.name} up`}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || i === stages.length - 1}
                onClick={() => move(s, 1)}
                aria-label={`Move ${s.name} down`}
              >
                ↓
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => toggleActive(s)}
              >
                {s.isActive ? "Deactivate" : "Activate"}
              </Button>
            </span>
          </li>
        ))}
        {stages.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No stages configured.
          </li>
        )}
      </ul>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit stage" : "Add stage"}
        description="Name and probability validate 0–100 server-side; keys stay unique."
        className="max-w-md"
      >
        <div className="space-y-4">
          <FormField label="Stage name" htmlFor="stage-name">
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
            />
          </FormField>
          {!editing && (
            <FormField label="Key (unique)" htmlFor="stage-key">
              <Input
                id="stage-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                maxLength={32}
                placeholder="e.g. discovery"
              />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Probability %" htmlFor="stage-prob">
              <Input
                id="stage-prob"
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                placeholder="Empty = unset"
              />
            </FormField>
            <FormField label="Order" htmlFor="stage-order">
              <Input
                id="stage-order"
                type="number"
                min={0}
                value={orderIndex}
                onChange={(e) => setOrderIndex(e.target.value)}
              />
            </FormField>
          </div>
          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isTerminal}
                onChange={(e) => setIsTerminal(e.target.checked)}
              />
              Terminal stage (no outgoing transitions)
            </label>
          )}
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
