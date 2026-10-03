"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { PIPELINE_STAGES } from "@/lib/opportunities/pipeline";

type StageRow = {
  key: string;
  name: string;
  probability: string;
  isTerminal: boolean;
};

function defaultRows(): StageRow[] {
  return PIPELINE_STAGES.map((s) => ({
    key: s.key,
    name: s.label,
    probability: String(s.probability),
    isTerminal: s.terminal,
  }));
}

/**
 * "+ New Pipeline" entry point for the Pipeline page. Defines the
 * organization's pipeline (name + ordered stages) through the existing
 * pipeline_stages model — no new tables. Stages holding opportunities
 * cannot be removed by a sync.
 */
export function NewPipelineButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stages, setStages] = useState<StageRow[]>(defaultRows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setStages(defaultRows());
    setError("");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    setStages(next);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Pipeline name is required.");
      if (!stages.length) throw new Error("Add at least one stage.");
      const cleaned = stages.map((s, i) => {
        if (!s.name.trim()) throw new Error(`Stage ${i + 1} needs a name.`);
        const probability = s.probability.trim() === "" ? null : Number(s.probability);
        if (probability !== null && (!Number.isInteger(probability) || probability < 0 || probability > 100)) {
          throw new Error(`Stage "${s.name.trim()}" probability must be 0–100.`);
        }
        return { key: s.key, name: s.name.trim(), probability, isTerminal: s.isTerminal };
      });
      const res = await fetch("/api/settings/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, stages: cleaned }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not save pipeline.");
      }
      toast({ variant: "success", title: `Pipeline "${trimmedName}" saved.` });
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save pipeline.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
      + New Pipeline
    </Button>
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="New Pipeline"
      description="Define the stage set used by opportunities and the kanban. Stages holding opportunities cannot be removed."
      className="max-w-lg"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <FormField label="Pipeline name" htmlFor="pipeline-name">
          <Input
            id="pipeline-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Sales"
          />
        </FormField>
        <div className="space-y-2">
          <p className="text-sm font-medium">Stages</p>
          {stages.map((stage, index) => (
            <div key={`${stage.key}-${index}`} className="space-y-2 rounded-md border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField label={`Stage ${index + 1} key`}>
                  <Select
                    aria-label={`Stage ${index + 1} key`}
                    value={stage.key}
                    onChange={(e) => setStages(stages.map((s, i) => i === index ? { ...s, key: e.target.value } : s))}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={`Stage ${index + 1} name`}>
                  <Input
                    aria-label={`Stage ${index + 1} name`}
                    value={stage.name}
                    maxLength={64}
                    onChange={(e) => setStages(stages.map((s, i) => i === index ? { ...s, name: e.target.value } : s))}
                  />
                </FormField>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField label="Probability %">
                  <Input
                    aria-label={`Stage ${index + 1} probability`}
                    type="number"
                    min={0}
                    max={100}
                    value={stage.probability}
                    onChange={(e) => setStages(stages.map((s, i) => i === index ? { ...s, probability: e.target.value } : s))}
                  />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stage.isTerminal}
                    onChange={(e) => setStages(stages.map((s, i) => i === index ? { ...s, isTerminal: e.target.checked } : s))}
                  />
                  Terminal stage
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move stage ${index + 1} up`}>↑</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === stages.length - 1} aria-label={`Move stage ${index + 1} down`}>↓</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setStages(stages.filter((_, i) => i !== index))} disabled={stages.length <= 1}>Remove</Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStages([...stages, { key: "new", name: "", probability: "10", isTerminal: false }])}
            disabled={stages.length >= 20}
          >
            Add stage
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" loading={busy} onClick={save}>Save Pipeline</Button>
        </div>
      </div>
    </Modal>
  </>;
}
