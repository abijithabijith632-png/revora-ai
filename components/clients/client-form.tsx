"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { CLIENT_STATUSES, clientStatusLabel } from "@/lib/clients/presentation";

export interface ClientFormValues {
  companyName: string;
  industry: string;
  companySize: string;
  corporateInfo: string;
  address: string;
  billingAddress: string;
  website: string;
  customerSince: string;
  status: string;
  notes: string;
}

function toValues(initial?: Partial<ClientFormValues>): ClientFormValues {
  return {
    companyName: initial?.companyName ?? "",
    industry: initial?.industry ?? "",
    companySize: initial?.companySize ?? "",
    corporateInfo: initial?.corporateInfo ?? "",
    address: initial?.address ?? "",
    billingAddress: initial?.billingAddress ?? "",
    website: initial?.website ?? "",
    customerSince: initial?.customerSince ?? "",
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  };
}

export function ClientForm({
  mode,
  clientId,
  initial,
}: {
  mode: "create" | "edit";
  clientId?: string;
  initial?: Partial<ClientFormValues>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<ClientFormValues>(() => toValues(initial));
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        customerSince: values.customerSince.trim() === "" ? null : values.customerSince,
      };

      const res = await fetch(mode === "create" ? "/api/clients" : `/api/clients/${clientId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Failed to save client.");
      }

      toast({
        variant: "success",
        title: mode === "create" ? "Client created" : "Client updated",
      });
      router.push(
        mode === "create" ? `/clients/${json.data.id}` : `/clients/${clientId}`,
      );
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not save client",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Company name" htmlFor="companyName" required>
          <Input
            id="companyName"
            value={values.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            required
          />
        </FormField>
        <FormField label="Industry" htmlFor="industry">
          <Input
            id="industry"
            value={values.industry}
            onChange={(e) => set("industry", e.target.value)}
          />
        </FormField>
        <FormField label="Company size" htmlFor="companySize">
          <Input
            id="companySize"
            value={values.companySize}
            onChange={(e) => set("companySize", e.target.value)}
          />
        </FormField>
        <FormField label="Website" htmlFor="website">
          <Input
            id="website"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://"
          />
        </FormField>
        <FormField label="Status" htmlFor="status">
          <Select
            id="status"
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {clientStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Customer since" htmlFor="customerSince">
          <Input
            id="customerSince"
            type="date"
            value={values.customerSince}
            onChange={(e) => set("customerSince", e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Corporate information" htmlFor="corporateInfo">
        <Textarea
          id="corporateInfo"
          value={values.corporateInfo}
          onChange={(e) => set("corporateInfo", e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Physical address" htmlFor="address">
          <Textarea
            id="address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            rows={2}
          />
        </FormField>
        <FormField label="Billing address" htmlFor="billingAddress">
          <Textarea
            id="billingAddress"
            value={values.billingAddress}
            onChange={(e) => set("billingAddress", e.target.value)}
            rows={2}
          />
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="notes">
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
          {mode === "create" ? "Create Client" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
