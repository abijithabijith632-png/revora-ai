"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, GitMerge } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";

interface DuplicateCandidate {
  id: string;
  leadNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: string;
  ownerName: string | null;
  matchReason: "email" | "phone" | "email_and_phone";
}

const REASON_LABELS: Record<DuplicateCandidate["matchReason"], string> = {
  email: "Email match",
  phone: "Phone match",
  email_and_phone: "Email + phone match",
};

/**
 * Duplicate detection banner + merge confirmation.
 */
export function LeadDuplicates({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/leads/${leadId}/duplicates`);
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      setDuplicates(json.data ?? []);
    } catch {
      /* keep empty */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function merge(targetLeadId: string) {
    if (
      !confirm(
        "Merge this duplicate into the current lead? The duplicate will be archived and marked as merged.",
      )
    ) {
      return;
    }
    setMerging(targetLeadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLeadId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Duplicate merged." });
      await load();
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Merge failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMerging(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Duplicates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Checking duplicates…</p>
        </CardContent>
      </Card>
    );
  }

  if (duplicates.length === 0) {
    return null;
  }

  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <Copy className="h-4 w-4" />
          Possible duplicates ({duplicates.length})
        </CardTitle>
        <CardDescription>
          Matched by normalized email or phone within your organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {duplicates.map((d) => (
          <div
            key={d.id}
            className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {d.fullName}{" "}
                <span className="text-muted-foreground">· {d.leadNumber}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {d.companyName ?? "No company"} · {d.ownerName ?? "Unassigned"}
              </p>
              <Badge variant="warning" className="mt-1">
                {REASON_LABELS[d.matchReason]}
              </Badge>
            </div>
            <Can permission="leads.edit">
              <Button
                size="sm"
                variant="outline"
                disabled={merging === d.id}
                onClick={() => merge(d.id)}
              >
                <GitMerge className="h-3 w-3" />
                Merge into this lead
              </Button>
            </Can>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
