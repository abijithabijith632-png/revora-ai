"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, FormField, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { PREFERRED_CHANNELS, preferredChannelLabel } from "@/lib/clients/presentation";

export function ContactForm({
  clientId,
  contactId,
  initial,
  onDone,
}: {
  clientId: string;
  contactId?: string;
  initial?: {
    firstName?: string;
    lastName?: string;
    designation?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    preferredChannel?: string;
    isPrimary?: boolean;
  };
  onDone?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    designation: initial?.designation ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    linkedinUrl: initial?.linkedinUrl ?? "",
    preferredChannel: initial?.preferredChannel ?? "email",
    isPrimary: initial?.isPrimary ?? false,
  });
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        clientId,
      };

      const res = await fetch(contactId ? `/api/contacts/${contactId}` : "/api/contacts", {
        method: contactId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Failed to save contact.");
      }

      toast({ variant: "success", title: contactId ? "Contact updated" : "Contact created" });
      onDone?.();
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not save contact",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <FormField label="Designation / Role" htmlFor="designation">
          <Input
            id="designation"
            value={values.designation}
            onChange={(e) => set("designation", e.target.value)}
          />
        </FormField>
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
        <FormField label="LinkedIn URL" htmlFor="linkedinUrl">
          <Input
            id="linkedinUrl"
            value={values.linkedinUrl}
            onChange={(e) => set("linkedinUrl", e.target.value)}
          />
        </FormField>
        <FormField label="Preferred communication" htmlFor="preferredChannel">
          <Select
            id="preferredChannel"
            value={values.preferredChannel}
            onChange={(e) => set("preferredChannel", e.target.value)}
          >
            {PREFERRED_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {preferredChannelLabel(c)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <Checkbox
        label="Set as primary contact"
        checked={values.isPrimary}
        onChange={(e) => set("isPrimary", e.target.checked)}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {contactId ? "Save Contact" : "Add Contact"}
        </Button>
      </div>
    </form>
  );
}
