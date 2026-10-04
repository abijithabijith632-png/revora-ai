"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

interface LeadOption {
  id: string;
  fullName: string;
  companyName: string | null;
  ownerId: string | null;
  ownerName: string | null;
}

interface EligibleAssignee {
  id: string;
  fullName: string;
  jobTitle: string | null;
}

/**
 * "+ New Assignment" workflow for the assignments page. Assigns (or
 * reassigns) a lead to an executive through the existing
 * PATCH /api/leads/[id]/assign endpoint — same contract as the lead-detail
 * assignment panel, with validation and error handling.
 */
export function NewAssignmentButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [eligible, setEligible] = useState<EligibleAssignee[]>([]);
  const [leadId, setLeadId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [loadingLists, setLoadingLists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadLeads() {
    setLoadingLists(true);
    setError("");
    try {
      const res = await fetch("/api/leads?page=1&pageSize=100");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not load leads.");
      }
      setLeads(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads.");
    } finally {
      setLoadingLists(false);
    }
  }

  async function loadEligible(id: string) {
    if (!id) {
      setEligible([]);
      return;
    }
    try {
      const res = await fetch(`/api/leads/${id}/assign`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not load assignees.");
      }
      setEligible(json.data?.eligible ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load assignees.");
    }
  }

  function openDialog() {
    setLeadId("");
    setAssigneeId("");
    setReason("");
    setError("");
    setEligible([]);
    setOpen(true);
    void loadLeads();
  }

  useEffect(() => {
    if (leadId) {
      setAssigneeId("");
      void loadEligible(leadId);
    } else {
      setEligible([]);
    }
  }, [leadId]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!leadId) throw new Error("Select a lead.");
      if (!assigneeId) throw new Error("Select an executive to assign.");
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: assigneeId,
          strategy: "manual",
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not assign lead.");
      }
      toast({ variant: "success", title: "Lead assigned." });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign lead.");
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    if (busy || !leadId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: null, strategy: "manual" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not unassign lead.");
      }
      toast({ variant: "success", title: "Lead unassigned." });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unassign lead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        + New Assignment
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Assignment"
        description="Assign a lead to an executive. Reassigning replaces the current owner."
        className="max-w-lg"
      >
        <div className="space-y-4">
          <FormField label="Lead" htmlFor="assignment-lead">
            <Select
              id="assignment-lead"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              disabled={loadingLists}
            >
              <option value="">Select a lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullName}
                  {l.companyName ? ` · ${l.companyName}` : ""}
                  {l.ownerName ? ` (owner: ${l.ownerName})` : " (unassigned)"}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Assign to" htmlFor="assignment-assignee">
            <Select
              id="assignment-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={!leadId || eligible.length === 0}
            >
              <option value="">
                {leadId
                  ? eligible.length
                    ? "Select an executive…"
                    : "No eligible assignees"
                  : "Select a lead first…"}
              </option>
              {eligible.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                  {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Reason (optional)" htmlFor="assignment-reason">
            <Textarea
              id="assignment-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this lead being assigned?"
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !leadId}
              onClick={unassign}
            >
              Unassign
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={busy}
                disabled={busy || !leadId || !assigneeId}
                onClick={submit}
              >
                Assign lead
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
