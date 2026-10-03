"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Select, Textarea } from "@/components/ui";

const agentLabels: Record<string, string> = { lead: "Lead Agent", deal: "Deal Agent", account: "Research / Account Agent", followup: "Follow-up Agent", forecast: "Forecast Agent", meeting: "Meeting Agent" };
type AgentResult = { agentId: string; label: string; summary: string; findings: string[]; recommendation: string; suggestedFollowup?: { contact: string; channel: string; message: string; priority: string }; proposedAction: { type: string; title: string; reason: string }; method: string; generatedAt: string; requiresConfirmation: boolean };

async function callApi<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error?.message ?? "AI agent request failed.");
  return json.data as T;
}

export function AgentWorkspace({ allowedAgentIds }: { allowedAgentIds: string[] }) {
  const [agentId, setAgentId] = useState(allowedAgentIds[0] ?? "lead"); const [targetId, setTargetId] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false); const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [dueAt, setDueAt] = useState(""); const [targetUserId, setTargetUserId] = useState(""); const [channel, setChannel] = useState("email");
  const [draftSubject, setDraftSubject] = useState(""); const [draftBody, setDraftBody] = useState("");
  const hasTarget = !["followup", "forecast"].includes(agentId); const actionType = result?.proposedAction.type;

  async function run(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null); setActionResult(null);
    try {
      const data = await callApi<AgentResult>("/api/agents/" + agentId, { ...(hasTarget ? { targetId } : {}) });
      setResult(data); setTitle(data.proposedAction.title); setDescription(data.proposedAction.reason);
    } catch (e) { setError(e instanceof Error ? e.message : "Agent is unavailable."); } finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!result || !actionType || actionType === "none") return;
    setActionBusy(true); setError(""); setActionResult(null);
    try {
      const response = await callApi<Record<string, unknown>>("/api/agents/actions", {
        agentId, ...(hasTarget ? { targetId } : {}), actionType, confirmed: true, title, description,
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}), channel, priority: "medium",
        ...(targetUserId ? { targetUserId } : {}), purpose: "general_follow_up",
      });
      setActionResult(response);
      if (response.draft && typeof response.draft === "object") {
        const draft = response.draft as { subject?: string; body?: string };
        setDraftSubject(draft.subject ?? ""); setDraftBody(draft.body ?? "");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Confirmed action failed."); } finally { setActionBusy(false); }
  }

  if (!allowedAgentIds.length) return <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">You do not have permission to run an AI agent.</p></CardContent></Card>;
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>CRM agents</CardTitle><CardDescription>Agents analyze authorized CRM records and prepare recommendations. They do not mutate records until you confirm a supported action.</CardDescription></CardHeader>
      <CardContent><form onSubmit={run} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField label="Agent" htmlFor="agent-id"><Select id="agent-id" value={agentId} onChange={(e) => { setAgentId(e.target.value); setResult(null); setActionResult(null); }} aria-label="Choose an AI agent">{allowedAgentIds.map((id) => <option key={id} value={id}>{agentLabels[id]}</option>)}</Select></FormField>
        {hasTarget ? <FormField label="CRM record ID" htmlFor="agent-target"><Input id="agent-target" value={targetId} onChange={(e) => setTargetId(e.target.value)} required placeholder="Paste the authorized record ID" /></FormField> : <p className="self-end pb-2 text-sm text-muted-foreground">{agentId === "forecast" ? "Uses organization pipeline and forecast data." : "Uses your assigned tasks, follow-ups, and meetings."}</p>}
        <div className="sm:col-span-2"><Button type="submit" disabled={busy || (hasTarget && !targetId.trim())}>{busy ? "Analyzing…" : "Run agent"}</Button></div>
      </form></CardContent>
    </Card>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {busy && <p role="status" className="text-sm text-muted-foreground">Analyzing authorized CRM context…</p>}
    {!result && !busy && !error && <p className="text-sm text-muted-foreground">Select an agent and run it to review CRM-backed findings.</p>}
    {result && <Card><CardHeader><CardTitle>{result.label}</CardTitle><CardDescription>Generated {new Date(result.generatedAt).toLocaleString()} · {result.method}</CardDescription></CardHeader><CardContent className="space-y-4">
      <p className="break-words text-sm">{result.summary}</p><ul className="list-disc space-y-1 pl-5 text-sm">{result.findings.map((item, i) => <li key={i}>{item}</li>)}</ul>
      <div className="rounded-md border border-border p-3"><p className="text-sm font-medium">Recommended next step</p><p className="text-sm">{result.recommendation}</p></div>
      {result.suggestedFollowup && <div className="break-words rounded-md border border-border p-3"><p className="text-sm font-medium">Suggested follow-up · {result.suggestedFollowup.priority} priority</p><p className="text-sm text-muted-foreground">Contact {result.suggestedFollowup.contact} by {result.suggestedFollowup.channel}.</p><p className="mt-2 whitespace-pre-wrap text-sm">{result.suggestedFollowup.message}</p></div>}
      <div className="space-y-3 rounded-md border border-ai/30 p-3"><p className="text-sm font-medium">Proposed action: {result.proposedAction.title}</p><p className="text-sm text-muted-foreground">{result.proposedAction.reason}</p>
        {actionType && actionType !== "none" ? <><FormField label="Confirm action title" htmlFor="agent-action-title"><Input id="agent-action-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required /></FormField><FormField label="Description" htmlFor="agent-action-description"><Textarea id="agent-action-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} /></FormField>
          {["create_task", "create_followup"].includes(actionType) && <FormField label="Due date (optional)" htmlFor="agent-action-due"><Input id="agent-action-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></FormField>}
          {actionType === "create_followup" && <FormField label="Follow-up channel" htmlFor="agent-action-channel"><Select id="agent-action-channel" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="email">Email</option><option value="phone">Phone</option><option value="meeting">Meeting</option><option value="whatsapp">WhatsApp</option></Select></FormField>}
          {actionType === "assign_lead" && <FormField label="Eligible assignee user ID" htmlFor="agent-assignee"><Input id="agent-assignee" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required /></FormField>}
          <Button onClick={confirmAction} disabled={actionBusy || !title.trim() || (actionType === "assign_lead" && !targetUserId.trim())}>{actionBusy ? "Applying confirmed action…" : actionType === "draft_email" ? "Confirm & generate editable draft" : actionType === "assign_lead" ? "Confirm lead assignment" : "Confirm & create CRM item"}</Button>
          <p className="text-xs text-muted-foreground">No changes occur until you press the confirmation button. Email actions create drafts only; they never send email.</p>
        </> : <p className="text-sm text-muted-foreground">No write action proposed.</p>}
      </div>
      {actionResult && <div role="status" className="space-y-3 rounded-md bg-surface-subtle p-3"><p className="text-sm">{String(actionResult.result)}</p>{Boolean(actionResult.draft) && <div className="space-y-3"><FormField label="Email subject" htmlFor="agent-draft-subject"><Input id="agent-draft-subject" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} maxLength={255} /></FormField><FormField label="Email body" htmlFor="agent-draft-body"><Textarea id="agent-draft-body" rows={8} value={draftBody} onChange={(e) => setDraftBody(e.target.value)} maxLength={10000} /></FormField><p className="text-xs text-muted-foreground">Editable draft only. No email was sent.</p></div>}</div>}
    </CardContent></Card>}
  </div>;
}
