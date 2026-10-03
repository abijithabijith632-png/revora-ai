"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  PIPELINE_STAGES,
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_SOURCE_LABELS,
} from "@/lib/opportunities/pipeline";

interface ClientOption {
  id: string;
  companyName: string;
}

export interface OpportunityFormValues {
  name: string;
  clientId: string;
  ownerId: string;
  amount: string;
  probability: string;
  expectedCloseDate: string;
  stageKey: string;
  source: string;
  productService: string;
  description: string;
  notes: string;
}

function toValues(initial?: Partial<OpportunityFormValues>): OpportunityFormValues {
  return {
    name: initial?.name ?? "",
    clientId: initial?.clientId ?? "",
    ownerId: initial?.ownerId ?? "",
    amount: initial?.amount ?? "",
    probability: initial?.probability ?? "",
    expectedCloseDate: initial?.expectedCloseDate ?? "",
    stageKey: initial?.stageKey ?? "new",
    source: initial?.source ?? "website",
    productService: initial?.productService ?? "",
    description: initial?.description ?? "",
    notes: initial?.notes ?? "",
  };
}

export function OpportunityForm({
  mode,
  opportunityId,
  clients,
  initial,
}: {
  mode: "create" | "edit";
  opportunityId?: string;
  clients: ClientOption[];
  initial?: Partial<OpportunityFormValues>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<OpportunityFormValues>(() => toValues(initial));
  const [submitting, setSubmitting] = useState(false);
  const [dbStages, setDbStages] = useState<Array<{ key: string; name: string }> | null>(null);

  // Offer the organization's configured stages so the form can never submit
  // a stage key the backend rejects. Falls back to canonical stages.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/pipeline-stages")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success || !Array.isArray(json.data)) return;
        const active = json.data
          .filter((s: { isActive?: boolean }) => s.isActive !== false)
          .map((s: { key: string; name: string }) => ({ key: s.key, name: s.name }))
          .filter((s: { key: string }) => typeof s.key === "string" && s.key.length > 0);
        if (cancelled || !active.length) return;
        setDbStages(active);
        setValues((prev) =>
          active.some((s: { key: string }) => s.key === prev.stageKey)
            ? prev
            : { ...prev, stageKey: active[0].key },
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function set<K extends keyof OpportunityFormValues>(key: K, value: OpportunityFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const stageOptions = dbStages ?? PIPELINE_STAGES.map((s) => ({ key: s.key, name: s.label }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        amount: values.amount.trim() === "" ? undefined : Number(values.amount),
        probability:
          values.probability.trim() === "" ? undefined : Number(values.probability),
        expectedCloseDate:
          values.expectedCloseDate.trim() === "" ? undefined : values.expectedCloseDate,
        ownerId: values.ownerId.trim() === "" ? undefined : values.ownerId,
      };

      const res = await fetch(
        mode === "create" ? "/api/opportunities" : `/api/opportunities/${opportunityId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Failed to save opportunity.");
      }

      toast({
        variant: "success",
        title: mode === "create" ? "Opportunity created" : "Opportunity updated",
      });
      router.push(
        mode === "create"
          ? `/opportunities/${json.data.id}`
          : `/opportunities/${opportunityId}`,
      );
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not save opportunity",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Opportunity name" htmlFor="name" required>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </FormField>
        <FormField label="Client" htmlFor="clientId" required>
          <Select
            id="clientId"
            value={values.clientId}
            onChange={(e) => set("clientId", e.target.value)}
            required
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Deal amount" htmlFor="amount">
          <Input
            id="amount"
            type="number"
            min={0}
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </FormField>
        <FormField label="Probability %" htmlFor="probability">
          <Input
            id="probability"
            type="number"
            min={0}
            max={100}
            value={values.probability}
            onChange={(e) => set("probability", e.target.value)}
          />
        </FormField>
        <FormField label="Expected close date" htmlFor="expectedCloseDate">
          <Input
            id="expectedCloseDate"
            type="date"
            value={values.expectedCloseDate}
            onChange={(e) => set("expectedCloseDate", e.target.value)}
          />
        </FormField>
        <FormField label="Pipeline stage" htmlFor="stageKey">
          <Select
            id="stageKey"
            value={values.stageKey}
            onChange={(e) => set("stageKey", e.target.value)}
          >
            {stageOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Source channel" htmlFor="source">
          <Select
            id="source"
            value={values.source}
            onChange={(e) => set("source", e.target.value)}
          >
            {OPPORTUNITY_SOURCES.map((s) => (
              <option key={s} value={s}>
                {OPPORTUNITY_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Product / Service" htmlFor="productService">
          <Input
            id="productService"
            value={values.productService}
            onChange={(e) => set("productService", e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="description">
        <Textarea
          id="description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </FormField>

      <FormField label="Deal notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "create" ? "Create Opportunity" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
