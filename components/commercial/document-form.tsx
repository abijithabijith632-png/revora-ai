"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select } from "@/components/ui";
import { documentTypeLabel } from "@/lib/commercial/presentation";

const DOCUMENT_TYPES = ["proposal", "contract", "invoice", "presentation", "nda", "other"];

export function DocumentForm({
  clientId,
  opportunityId,
}: {
  clientId?: string;
  opportunityId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      documentType: form.get("documentType") as string,
      fileReference: form.get("fileReference") as string,
      mimeType: form.get("mimeType") as string,
      sizeBytes: form.get("sizeBytes") ? Number(form.get("sizeBytes")) : undefined,
      ...(clientId ? { clientId } : {}),
      ...(opportunityId ? { opportunityId } : {}),
    };

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to add document");
      router.push("/documents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <FormField label="Name" htmlFor="doc-name" required>
        <Input id="doc-name" name="name" placeholder="Document name" required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Type" htmlFor="doc-type">
          <Select id="doc-type" name="documentType" defaultValue="other">
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {documentTypeLabel(t)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="MIME type" htmlFor="doc-mime">
          <Input id="doc-mime" name="mimeType" placeholder="application/pdf" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="File reference" htmlFor="doc-ref">
          <Input id="doc-ref" name="fileReference" placeholder="Opaque reference" />
        </FormField>
        <FormField label="Size (bytes)" htmlFor="doc-size">
          <Input id="doc-size" name="sizeBytes" type="number" min={0} />
        </FormField>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Add document"}
        </Button>
      </div>
    </form>
  );
}
