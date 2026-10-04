"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

export interface OrganizationInitial {
  name: string;
  industry: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  description: string | null;
  logoUrl: string | null;
  currency: string;
  timezone: string;
  dateFormat: string;
}

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
const TIMEZONES = ["UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];
const DATE_FORMATS = ["MMM d, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"];

async function patch(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status}).`);
  }
  return json.data;
}

/**
 * Organization profile + regional preferences editor. Writes through the
 * existing PATCH /api/organization (profile/branding) and PATCH
 * /api/settings (timezone/currency/date format) endpoints. The organization
 * status badge stays read-only: status transitions are platform-managed.
 */
export function OrganizationForm({ initial }: { initial: OrganizationInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState({
    name: initial.name,
    industry: initial.industry ?? "",
    website: initial.website ?? "",
    contactEmail: initial.contactEmail ?? "",
    contactPhone: initial.contactPhone ?? "",
    address: initial.address ?? "",
    description: initial.description ?? "",
    logoUrl: initial.logoUrl ?? "",
    currency: initial.currency,
    timezone: initial.timezone,
    dateFormat: initial.dateFormat,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(k: K, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (!values.name.trim()) throw new Error("Organization name is required.");
      await patch("/api/organization", {
        name: values.name.trim(),
        industry: values.industry.trim() || null,
        website: values.website.trim() || null,
        contactEmail: values.contactEmail.trim() || null,
        contactPhone: values.contactPhone.trim() || null,
        address: values.address.trim() || null,
        description: values.description.trim() || null,
        logoUrl: values.logoUrl.trim() || null,
      });
      await patch("/api/settings", {
        currency: values.currency,
        timezone: values.timezone,
        dateFormat: values.dateFormat,
      });
      toast({ variant: "success", title: "Organization updated." });
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not save organization",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Company name" htmlFor="org-name" required>
          <Input
            id="org-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            maxLength={255}
          />
        </FormField>
        <FormField label="Industry" htmlFor="org-industry">
          <Input
            id="org-industry"
            value={values.industry}
            onChange={(e) => set("industry", e.target.value)}
            maxLength={128}
            placeholder="e.g. Software"
          />
        </FormField>
        <FormField label="Website" htmlFor="org-website">
          <Input
            id="org-website"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            inputMode="url"
            placeholder="https://…"
          />
        </FormField>
        <FormField label="Logo URL (branding)" htmlFor="org-logo">
          <Input
            id="org-logo"
            value={values.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
            inputMode="url"
            placeholder="https://…/logo.png"
          />
        </FormField>
        <FormField label="Contact email" htmlFor="org-email">
          <Input
            id="org-email"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="hello@company.com"
          />
        </FormField>
        <FormField label="Contact phone" htmlFor="org-phone">
          <Input
            id="org-phone"
            value={values.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            inputMode="tel"
            maxLength={32}
          />
        </FormField>
      </div>
      <FormField label="Address" htmlFor="org-address">
        <Textarea
          id="org-address"
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          rows={2}
        />
      </FormField>
      <FormField label="Description" htmlFor="org-description">
        <Textarea
          id="org-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Currency" htmlFor="org-currency">
          <Select
            id="org-currency"
            value={values.currency}
            onChange={(e) => set("currency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Timezone" htmlFor="org-timezone">
          <Select
            id="org-timezone"
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          >
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Date format" htmlFor="org-date-format">
          <Select
            id="org-date-format"
            value={values.dateFormat}
            onChange={(e) => set("dateFormat", e.target.value)}
          >
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={saving}>
          Save organization
        </Button>
      </div>
    </form>
  );
}
