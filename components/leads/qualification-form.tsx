"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  QUALIFICATION_CRITERIA,
  QUALIFICATION_OUTCOMES,
  OUTCOME_LABELS,
  DISQUALIFICATION_REASONS,
  DISQUALIFICATION_REASON_LABELS,
} from "@/lib/leads/qualification";

/**
 * Reusable qualification assessment form. Submits to
 * /api/leads/[id]/qualification.
 */
export function QualificationForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    outcome: "qualified",
    applyTransition: "true",
  });

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        applyTransition: values.applyTransition === "true",
      };

      const res = await fetch(`/api/leads/${leadId}/qualification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json?.error?.message ?? "Failed to save qualification.");
      }

      toast({ variant: "success", title: "Qualification saved successfully." });
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Unable to save qualification",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-4">
        {QUALIFICATION_CRITERIA.map((criterion) => (
          <FormField
            key={criterion.key}
            label={criterion.label}
            htmlFor={criterion.key}
            hint={criterion.explanation}
          >
            <Select
              id={criterion.key}
              value={values[criterion.key] ?? ""}
              onChange={(e) => set(criterion.key, e.target.value)}
              required
            >
              <option value="" disabled>
                Select…
              </option>
              {criterion.values.map((v) => (
                <option key={v} value={v}>
                  {criterion.valueLabels[v]}
                </option>
              ))}
            </Select>
          </FormField>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Decision maker name" htmlFor="decisionMakerName">
          <Input
            id="decisionMakerName"
            value={values.decisionMakerName ?? ""}
            onChange={(e) => set("decisionMakerName", e.target.value)}
          />
        </FormField>
        <FormField label="Decision maker designation" htmlFor="decisionMakerDesignation">
          <Input
            id="decisionMakerDesignation"
            value={values.decisionMakerDesignation ?? ""}
            onChange={(e) => set("decisionMakerDesignation", e.target.value)}
          />
        </FormField>
      </div>

      <FormField
        label="Qualification outcome"
        htmlFor="outcome"
        hint="The overall qualification result."
      >
        <Select
          id="outcome"
          value={values.outcome}
          onChange={(e) => set("outcome", e.target.value)}
          required
        >
          {QUALIFICATION_OUTCOMES.filter((o) => o !== "pending").map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </Select>
      </FormField>

      {values.outcome === "unqualified" && (
        <FormField
          label="Disqualification reason"
          htmlFor="reason"
          hint="Required when the outcome is Unqualified."
          required
        >
          <Select
            id="reason"
            value={values.reason ?? ""}
            onChange={(e) => set("reason", e.target.value)}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {DISQUALIFICATION_REASONS.map((r) => (
              <option key={r} value={r}>
                {DISQUALIFICATION_REASON_LABELS[r]}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </FormField>

      <FormField
        label="Apply lifecycle transition"
        htmlFor="applyTransition"
        hint="When enabled, the permitted lifecycle status change is applied together with the assessment."
      >
        <Select
          id="applyTransition"
          value={values.applyTransition}
          onChange={(e) => set("applyTransition", e.target.value)}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </FormField>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save qualification
        </Button>
      </div>
    </form>
  );
}
