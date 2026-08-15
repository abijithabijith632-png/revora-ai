"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { PROPOSAL_STATUSES } from "@/lib/commercial/schemas";
import { proposalStatusLabel } from "@/lib/commercial/presentation";

export function ProposalForm({
  opportunityId,
  clientId,
}: {
  opportunityId?: string;
  clientId?: string;
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
      title: form.get("title") as string,
      ...(opportunityId ? { opportunityId } : {}),
      ...(clientId ? { clientId } : {}),
      amount: form.get("amount") ? Number(form.get("amount")) : undefined,
      status: form.get("status") as string,
      expiryDate: (form.get("expiryDate") as string) || undefined,
      notes: form.get("notes") as string,
    };

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to create proposal");
      router.push("/proposals");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create proposal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <FormField label="Title" htmlFor="proposal-title" required>
        <Input id="proposal-title" name="title" placeholder="Proposal title" required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Amount" htmlFor="proposal-amount">
          <Input id="proposal-amount" name="amount" type="number" min={0} />
        </FormField>
        <FormField label="Status" htmlFor="proposal-status">
          <Select id="proposal-status" name="status" defaultValue="draft">
            {PROPOSAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {proposalStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Expiry date" htmlFor="proposal-expiry">
          <Input id="proposal-expiry" name="expiryDate" type="date" />
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="proposal-notes">
        <Textarea id="proposal-notes" name="notes" rows={3} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Create proposal"}
        </Button>
      </div>
    </form>
  );
}
