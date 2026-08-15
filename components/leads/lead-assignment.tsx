"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, Zap } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  FormField,
  Select,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";

interface EligibleAssignee {
  id: string;
  fullName: string;
  jobTitle: string | null;
  workload: number;
}

interface AssignmentRecord {
  id: string;
  assignedToName: string | null;
  strategy: string | null;
  reason: string | null;
  assignedAt: string;
}

function strategyLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Assignment panel: employee selector + strategy + reason + history timeline.
 */
export function LeadAssignment({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [eligible, setEligible] = useState<EligibleAssignee[]>([]);
  const [history, setHistory] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`);
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      setEligible(json.data?.eligible ?? []);
      setHistory(json.data?.history ?? []);
    } catch {
      /* keep empty state */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function manualAssign() {
    if (!assigneeId) return;
    setBusy(true);
    try {
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
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Lead assigned." });
      setAssigneeId("");
      setReason("");
      await load();
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Assignment failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function autoAssign(nextStrategy: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/assign/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: nextStrategy }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Lead auto-assigned." });
      await load();
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Auto-assignment failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-4 w-4" />
          Lead Assignment
        </CardTitle>
        <CardDescription>
          Assign an eligible executive or route automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Can permission="leads.assign">
          <div className="space-y-3">
            <FormField label="Assign to" htmlFor="assignee">
              <Select
                id="assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={busy || loading}
              >
                <option value="">Select an executive…</option>
                {eligible.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.jobTitle ?? "Executive"}) · {u.workload} leads
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Reason" htmlFor="assignReason">
              <Textarea
                id="assignReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional reason for reassignment"
                rows={2}
              />
            </FormField>

            <Button
              size="sm"
              onClick={manualAssign}
              loading={busy}
              disabled={!assigneeId || loading}
            >
              Assign Manually
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Auto-route</Badge>
              {(["round_robin", "territory", "skill"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => autoAssign(s)}
                >
                  <Zap className="h-3 w-3" />
                  {strategyLabel(s)}
                </Button>
              ))}
            </div>
          </div>
        </Can>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading assignment…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignment history.</p>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Assignment history ({history.length})
            </p>
            <ol className="mt-2 space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="neutral">
                    {strategyLabel(h.strategy ?? "manual")}
                  </Badge>
                  <span className="text-foreground">
                    {h.assignedToName ?? "Unassigned"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.assignedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
