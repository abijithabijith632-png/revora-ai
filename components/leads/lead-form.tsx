"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
} from "@/lib/leads/schemas";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/presentation";

/**
 * Shared create/edit lead form. On create it POSTs to /api/leads; on edit it
 * PATCHes /api/leads/[id]. `initial` is undefined for the create flow.
 */

export interface LeadFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  companyName: string;
  industry: string;
  companySize: string;
  geography: string;
  website: string;
  source: string;
  status: string;
  budget: string;
  expectedClosingDate: string;
  interestedProduct: string;
  notes: string;
}

export interface LeadFormProps {
  mode: "create" | "edit";
  leadId?: string;
  initial?: Partial<LeadFormValues>;
}

function toValues(initial?: Partial<LeadFormValues>): LeadFormValues {
  return {
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    alternatePhone: initial?.alternatePhone ?? "",
    companyName: initial?.companyName ?? "",
    industry: initial?.industry ?? "",
    companySize: initial?.companySize ?? "",
    geography: initial?.geography ?? "",
    website: initial?.website ?? "",
    source: initial?.source ?? "manual",
    status: initial?.status ?? "new",
    budget: initial?.budget ?? "",
    expectedClosingDate: initial?.expectedClosingDate ?? "",
    interestedProduct: initial?.interestedProduct ?? "",
    notes: initial?.notes ?? "",
  };
}

export function LeadForm({ mode, leadId, initial }: LeadFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<LeadFormValues>(() => toValues(initial));
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        budget: values.budget.trim() === "" ? null : Number(values.budget),
        expectedClosingDate:
          values.expectedClosingDate.trim() === ""
            ? null
            : values.expectedClosingDate,
      };

      const res = await fetch(
        mode === "create" ? "/api/leads" : `/api/leads/${leadId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Failed to save lead.");
      }

      toast({
        variant: "success",
        title: mode === "create" ? "Lead created" : "Lead updated",
      });

      router.push(
        mode === "create" ? `/leads/${json.data.id}` : `/leads/${leadId}`,
      );
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not save lead",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="firstName" required>
          <Input
            id="firstName"
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </FormField>
        <FormField label="Last name" htmlFor="lastName">
          <Input
            id="lastName"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input
            id="phone"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Company" htmlFor="companyName">
          <Input
            id="companyName"
            value={values.companyName}
            onChange={(e) => set("companyName", e.target.value)}
          />
        </FormField>
        <FormField label="Industry" htmlFor="industry">
          <Input
            id="industry"
            value={values.industry}
            onChange={(e) => set("industry", e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Company size" htmlFor="companySize">
          <Input
            id="companySize"
            value={values.companySize}
            onChange={(e) => set("companySize", e.target.value)}
          />
        </FormField>
        <FormField label="Geography" htmlFor="geography">
          <Input
            id="geography"
            value={values.geography}
            onChange={(e) => set("geography", e.target.value)}
          />
        </FormField>
        <FormField label="Website" htmlFor="website">
          <Input
            id="website"
            type="url"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Source" htmlFor="source">
          <Select
            id="source"
            value={values.source}
            onChange={(e) => set("source", e.target.value)}
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="status">
          <Select
            id="status"
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Budget" htmlFor="budget">
          <Input
            id="budget"
            type="number"
            min={0}
            value={values.budget}
            onChange={(e) => set("budget", e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Expected closing date" htmlFor="expectedClosingDate">
          <Input
            id="expectedClosingDate"
            type="date"
            value={values.expectedClosingDate}
            onChange={(e) => set("expectedClosingDate", e.target.value)}
          />
        </FormField>
        <FormField label="Interested product" htmlFor="interestedProduct">
          <Input
            id="interestedProduct"
            value={values.interestedProduct}
            onChange={(e) => set("interestedProduct", e.target.value)}
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

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "create" ? "Create lead" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
