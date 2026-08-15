"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

interface ConversionPreview {
  lead: {
    id: string;
    leadNumber: string;
    fullName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    industry: string | null;
    website: string | null;
    ownerName: string | null;
    qualificationStatus: string;
  };
  existingClient: { id: string; clientNumber: string; companyName: string } | null;
  canConvert: boolean;
  reason?: string;
}

/**
 * Conversion review dialog. Shows source lead, client preview, existing match,
 * and performs the transactional convert.
 */
export function ConvertLeadDialog({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/convert`);
        const json = await res.json();
        if (!json.success) throw new Error(json?.error?.message ?? "Failed");
        setPreview(json.data);
      } catch (err) {
        toast({
          variant: "error",
          title: "Unable to load conversion",
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function convert(linkToClientId?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkToClientId ? { linkToClientId } : {}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      toast({ variant: "success", title: "Lead converted to client." });
      router.push(`/clients/${json.data.clientId}`);
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Unable to convert lead",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Convert to Client"
      description="Converting this qualified lead creates or links a client while preserving its historical activity."
      className="max-w-xl"
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading conversion preview…</p>
      ) : !preview ? (
        <p className="text-sm text-muted-foreground">Unable to load conversion.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-md border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Source lead</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {preview.lead.leadNumber} · {preview.lead.fullName}
            </p>
            <p className="text-sm text-muted-foreground">
              {preview.lead.companyName ?? "No company"} · {preview.lead.email ?? "No email"}
            </p>
            <Badge variant={preview.lead.qualificationStatus === "qualified" ? "success" : "neutral"}>
              {preview.lead.qualificationStatus}
            </Badge>
          </div>

          {!preview.canConvert && (
            <p className="rounded-md bg-danger-bg p-3 text-sm text-danger">
              {preview.reason ?? "Lead is not qualified for conversion."}
            </p>
          )}

          {preview.existingClient && (
            <div className="rounded-md border border-warning/40 bg-warning-bg/20 p-4">
              <p className="text-sm font-medium text-warning">
                An existing client may match this lead.
              </p>
              <p className="mt-1 text-sm text-foreground">
                {preview.existingClient.clientNumber} · {preview.existingClient.companyName}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={busy || !preview.canConvert}
                onClick={() => convert(preview.existingClient!.id)}
              >
                <ArrowRightLeft className="h-3 w-3" />
                Link to existing client
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => convert()}
              loading={busy}
              disabled={!preview.canConvert}
            >
              Convert to Client
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
