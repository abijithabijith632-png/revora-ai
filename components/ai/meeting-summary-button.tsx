"use client";

import { useState } from "react";
import { Button, Card, CardContent } from "@/components/ui";

type MeetingSummary = { summary?: string; discussionPoints?: string[]; customerConcerns?: string[]; actionItems?: Array<{ description: string; owner?: string }>; followUpRecommendations?: string[]; insufficientData?: boolean; message?: string; source?: string; transcriptProcessed?: boolean };
export function MeetingSummaryButton({ meetingId }: { meetingId: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState<MeetingSummary | null>(null);
  async function summarize() {
    if (busy) return;
    setBusy(true); setError(""); setResult(null);
    try { const response = await fetch(`/api/meetings/${meetingId}/summary`, { method: "POST" }); const json = await response.json();
      if (!json.success) throw new Error(json.error?.message ?? "Summary unavailable."); setResult(json.data); }
    catch (e) { setError(e instanceof Error ? e.message : "Summary unavailable. AI may not be configured."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2"><Button size="sm" variant="outline" loading={busy} disabled={busy} onClick={summarize}>Summarize notes</Button>
    {error && <p role="alert" className="max-w-56 text-xs text-danger">{error}</p>}
    {result?.insufficientData && <p className="max-w-56 text-xs text-muted-foreground">{result.message}</p>}
    {result?.summary && <Card className="min-w-64"><CardContent className="space-y-2 p-3 text-left"><p className="text-sm">{result.summary}</p>
      {result.discussionPoints?.map((item) => <p key={item} className="text-xs text-muted-foreground">• {item}</p>)}
      {result.customerConcerns?.length ? <p className="text-xs">Concerns: {result.customerConcerns.join(" · ")}</p> : null}
      {result.actionItems?.length ? <p className="text-xs">Actions: {result.actionItems.map((item) => item.description).join(" · ")}</p> : null}
      <p className="text-[10px] text-faint">Based on saved meeting notes. No audio/video transcript processed.</p></CardContent></Card>}
  </div>;
}
