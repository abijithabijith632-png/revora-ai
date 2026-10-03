"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Select, Textarea } from "@/components/ui";

type CopilotResult = { answer: string; references: Array<{ entityType: string; id: string; reason: string }>; aiUnavailable: boolean; method: string };
type EmailDraft = { subject: string; body: string; contextUsed: string[]; sent: false; model: string };
type ConversationResult = { summary: string; sentiment: string; objections: string[]; buyingSignals: string[]; competitorMentions: string[]; customerConcerns: string[]; nextSteps: string[]; model: string };

async function postJson<T>(url: string, data: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const json = await response.json();
  if (!json.success) throw new Error(json.error?.message ?? "AI request failed.");
  return json.data as T;
}

export function Phase2AiWorkspace() {
  const [question, setQuestion] = useState(""); const [copilot, setCopilot] = useState<CopilotResult | null>(null);
  const [copilotBusy, setCopilotBusy] = useState(false); const [copilotError, setCopilotError] = useState("");
  const [entityType, setEntityType] = useState("lead"); const [entityId, setEntityId] = useState(""); const [purpose, setPurpose] = useState("general_follow_up");
  const [draft, setDraft] = useState<EmailDraft | null>(null); const [emailBusy, setEmailBusy] = useState(false); const [emailError, setEmailError] = useState("");
  const [transcript, setTranscript] = useState(""); const [conversation, setConversation] = useState<ConversationResult | null>(null); const [conversationBusy, setConversationBusy] = useState(false); const [conversationError, setConversationError] = useState("");

  async function ask(event: React.FormEvent) { event.preventDefault(); setCopilotBusy(true); setCopilotError(""); setCopilot(null);
    try { setCopilot(await postJson("/api/ai/copilot", { question })); } catch (error) { setCopilotError(error instanceof Error ? error.message : "Copilot is unavailable."); } finally { setCopilotBusy(false); } }
  async function generateEmail(event: React.FormEvent) { event.preventDefault(); setEmailBusy(true); setEmailError(""); setDraft(null);
    try { setDraft(await postJson("/api/ai/email-draft", { entityType, entityId, purpose })); } catch (error) { setEmailError(error instanceof Error ? error.message : "Email drafting is unavailable."); } finally { setEmailBusy(false); } }
  async function analyze(event: React.FormEvent) { event.preventDefault(); setConversationBusy(true); setConversationError(""); setConversation(null);
    try { setConversation(await postJson("/api/ai/conversation-analysis", { transcript })); } catch (error) { setConversationError(error instanceof Error ? error.message : "Conversation analysis is unavailable."); } finally { setConversationBusy(false); } }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>Sales Copilot</CardTitle><CardDescription>Ask about CRM priorities. Answers use only records you are authorized to view and include record references.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><form onSubmit={ask} className="space-y-3"><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} rows={2} placeholder="Which opportunities have recorded risk signals?" />
        <Button size="sm" loading={copilotBusy} disabled={question.trim().length < 2}>Ask Copilot</Button></form>
        {copilotBusy && <p role="status" className="text-sm text-muted-foreground">Reviewing authorized CRM evidence…</p>}
        {copilotError && <p role="alert" className="text-sm text-danger">{copilotError} AI may be unavailable; try again later.</p>}
        {copilot && <div className="space-y-2 rounded-md border border-border p-3"><p className="text-sm">{copilot.answer}</p><p className="text-xs text-muted-foreground">Method: {copilot.method}{copilot.aiUnavailable ? " · AI unavailable; showing a deterministic CRM fallback." : ""}</p>
          {copilot.references.map((ref) => <p key={`${ref.entityType}-${ref.id}`} className="text-sm text-muted-foreground">{ref.entityType}: {ref.reason} <Link className="text-brand-600 hover:underline" href={ref.entityType === "lead" ? `/leads/${ref.id}` : ref.entityType === "opportunity" ? `/opportunities/${ref.id}` : "/tasks"}>View</Link></p>)}</div>}
        {!copilot && !copilotError && !copilotBusy && <p className="text-sm text-muted-foreground">Ask a question to see CRM-backed evidence.</p>}
      </CardContent></Card>

    <Card><CardHeader><CardTitle>Follow-up & email draft</CardTitle><CardDescription>Generates an editable draft from one authorized CRM record. This does not send email.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><form onSubmit={generateEmail} className="grid gap-3 sm:grid-cols-2">
        <FormField label="Record type"><Select value={entityType} onChange={(e) => setEntityType(e.target.value)}><option value="lead">Lead</option><option value="contact">Contact</option><option value="opportunity">Opportunity</option></Select></FormField>
        <FormField label="Record ID"><Input value={entityId} onChange={(e) => setEntityId(e.target.value)} required placeholder="Paste CRM record ID" /></FormField>
        <FormField label="Email purpose"><Select value={purpose} onChange={(e) => setPurpose(e.target.value)}><option value="general_follow_up">General follow-up</option><option value="demo_follow_up">Demo follow-up</option><option value="proposal_follow_up">Proposal follow-up</option><option value="meeting_confirmation">Meeting confirmation</option><option value="re_engagement">Re-engagement</option><option value="missed_follow_up">Missed follow-up</option></Select></FormField>
        <div className="flex items-end"><Button size="sm" loading={emailBusy} disabled={!entityId.trim()}>Generate editable draft</Button></div>
      </form>
      {emailError && <p role="alert" className="text-sm text-danger">{emailError}</p>}
      {draft && <div className="space-y-3 rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Generated with {draft.model}. Edit before using. Not sent.</p><FormField label="Subject"><Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></FormField><FormField label="Email body"><Textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></FormField><p className="text-xs text-muted-foreground">Context used: {draft.contextUsed.join(" · ")}</p></div>}
      {!draft && !emailError && !emailBusy && <p className="text-sm text-muted-foreground">Choose a CRM record and purpose to create a draft.</p>}
      </CardContent></Card>

    <Card><CardHeader><CardTitle>Conversation intelligence</CardTitle><CardDescription>Analyze user-provided text or an existing transcript. No audio or video transcription is available.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><form onSubmit={analyze} className="space-y-3"><Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6} maxLength={30000} placeholder="Paste a transcript or conversation text you are authorized to process." /><Button size="sm" loading={conversationBusy} disabled={transcript.trim().length < 20}>Analyze conversation text</Button></form>
        {conversationError && <p role="alert" className="text-sm text-danger">{conversationError}</p>}
        {conversation && <div className="space-y-2 rounded-md border border-border p-3"><p className="text-sm">{conversation.summary}</p><p className="text-xs text-muted-foreground">Sentiment: {conversation.sentiment} · {conversation.model}</p>{[["Objections", conversation.objections], ["Buying signals", conversation.buyingSignals], ["Competitor mentions", conversation.competitorMentions], ["Customer concerns", conversation.customerConcerns], ["Next steps", conversation.nextSteps]].map(([label, items]) => <div key={label as string}><p className="text-sm font-medium">{label}</p><ul className="list-inside list-disc text-sm text-muted-foreground">{(items as string[]).length ? (items as string[]).map((item) => <li key={item}>{item}</li>) : <li>None evidenced in the supplied text.</li>}</ul></div>)}</div>}
        {!conversation && !conversationError && !conversationBusy && <p className="text-sm text-muted-foreground">A transcript/text input is required. Revora does not transcribe audio or video.</p>}
      </CardContent></Card>
  </div>;
}
