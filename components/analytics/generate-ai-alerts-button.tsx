"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

export function GenerateAiAlertsButton() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function generate() {
    setBusy(true);
    try {
      const response = await fetch("/api/analytics/alerts", { method: "POST" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error?.message ?? "Could not evaluate alerts.");
      toast({ variant: "success", title: `${json.data.created} new alert(s) created` });
    } catch (error) {
      toast({ variant: "error", title: "Alert generation failed", description: error instanceof Error ? error.message : undefined });
    } finally { setBusy(false); }
  }
  return <Button size="sm" variant="outline" loading={busy} onClick={generate}>Evaluate deal risk alerts</Button>;
}
