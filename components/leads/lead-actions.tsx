"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Trash2, UserCog, ArrowRightLeft } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import { allowedNextStatuses } from "@/lib/leads/lifecycle";
import { LEAD_STATUS_LABELS } from "@/lib/leads/presentation";
import type { LeadStatus } from "@/lib/leads/schemas";

/**
 * Detail-page actions: edit (nav), controlled status change, archive.
 */
export function LeadActions({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const allowed = allowedNextStatuses(currentStatus as LeadStatus);

  async function changeStatus(next: string) {
    if (next === currentStatus) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Lead lifecycle updated." });
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not update status",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!confirm("Archive this lead? This is reversible only by an admin.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Lead archived" });
      router.push("/leads");
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Could not archive lead",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Can permission="leads.edit">
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/leads/${leadId}/edit`)}
        >
          <Edit className="h-4 w-4" />
          Edit
        </Button>
      </Can>

      <Can permission="leads.edit">
        {allowed.length > 0 ? (
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <Select
              value={currentStatus}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value)}
              className="h-9 w-44"
              aria-label="Change status"
            >
              <option value={currentStatus}>{LEAD_STATUS_LABELS[currentStatus as LeadStatus]}</option>
              {allowed.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <BadgeDisabled label={LEAD_STATUS_LABELS[currentStatus as LeadStatus]} />
        )}
      </Can>

      <Can permission="leads.assign">
        <Button size="sm" variant="ghost" disabled title="Owner assignment">
          <UserCog className="h-4 w-4" />
          Assign
        </Button>
      </Can>

      <Can permission="leads.delete">
        <Button size="sm" variant="danger" onClick={archive} loading={busy}>
          <Trash2 className="h-4 w-4" />
          Archive
        </Button>
      </Can>
    </div>
  );
}

function BadgeDisabled({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
      <ArrowRightLeft className="h-4 w-4" />
      {label} (final)
    </span>
  );
}
