"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Select } from "@/components/ui";

type Step = { type: "email" | "wait" | "followup" | "activity" | "review"; label: string; delayMinutes?: number; description?: string };
type Execution = { id: string; stepIndex: number; result: string; executedAt: string };
type Enrollment = { id: string; leadId: string; status: string; currentStep: number; nextRunAt: string | null; executions: Execution[] };
type Sequence = { id: string; name: string; description: string | null; status: string; steps: Step[]; enrollments: Enrollment[] };
type Lead = { id: string; leadNumber: string; fullName: string };

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json(); if (!json.success) throw new Error(json.error?.message ?? "Request failed."); return json.data;
}

export function SequenceManager({ initialSequences, leads }: { initialSequences: Sequence[]; leads: Lead[] }) {
  const [sequences, setSequences] = useState(initialSequences); const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ type: "email", label: "Follow-up email draft", description: "Review and compose before sending." }]);
  const [editingId, setEditingId] = useState<string | null>(null); const [selectedLead, setSelectedLead] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function refresh() { setLoading(true); try { setSequences(await api("/api/sequences")); } catch (e) { setError(e instanceof Error ? e.message : "Could not refresh sequences."); } finally { setLoading(false); } }
  function resetForm() { setEditingId(null); setName(""); setDescription(""); setSteps([{ type: "email", label: "Follow-up email draft", description: "Review and compose before sending." }]); }
  async function save(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await api(editingId ? `/api/sequences/${editingId}` : "/api/sequences", editingId ? "PATCH" : "POST", { name, description, steps });
      setNotice(editingId ? "Sequence saved." : "Draft sequence created."); resetForm(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save sequence."); } finally { setBusy(false); } }
  async function stateChange(sequence: Sequence, action: string) { setBusy(true); setError("");
    try { await api(`/api/sequences/${sequence.id}/status`, "POST", { action }); setNotice(`Sequence ${action} complete.`); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update sequence."); } finally { setBusy(false); } }
  async function enroll(sequence: Sequence) { const leadId = selectedLead[sequence.id]; if (!leadId) return; setBusy(true); setError("");
    try { await api(`/api/sequences/${sequence.id}/enrollments`, "POST", { leadId }); setNotice("Lead enrolled."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not enroll lead."); } finally { setBusy(false); } }
  async function run(sequence: Sequence, enrollment: Enrollment) { setBusy(true); setError("");
    try { const data = await api(`/api/sequences/${sequence.id}/run`, "POST", { enrollmentId: enrollment.id }); setNotice(`Step ${data.execution.stepIndex + 1} recorded: ${data.execution.result}.`); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not run step."); } finally { setBusy(false); } }
  function edit(sequence: Sequence) { setEditingId(sequence.id); setName(sequence.name); setDescription(sequence.description ?? ""); setSteps(sequence.steps); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>{editingId ? "Edit sequence" : "Create sales sequence"}</CardTitle><CardDescription>Sequence runs are manual. Email steps create drafts only; no external email is sent.</CardDescription></CardHeader>
      <CardContent><form onSubmit={save} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><FormField label="Sequence name"><Input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></FormField><FormField label="Description"><Input maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></FormField></div>
        <div className="space-y-3"><p className="text-sm font-medium">Steps</p>{steps.map((step, index) => <div key={index} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
          <Select value={step.type} onChange={(e) => setSteps(steps.map((s, i) => i === index ? { ...s, type: e.target.value as Step["type"] } : s))}><option value="email">Email draft</option><option value="wait">Wait</option><option value="followup">Follow-up</option><option value="activity">Activity</option><option value="review">Review</option></Select>
          <Input aria-label="Step label" value={step.label} onChange={(e) => setSteps(steps.map((s, i) => i === index ? { ...s, label: e.target.value } : s))} placeholder="Step label" />
          <Input aria-label="Delay minutes" type="number" min={1} max={525600} value={step.delayMinutes ?? ""} onChange={(e) => setSteps(steps.map((s, i) => i === index ? { ...s, delayMinutes: e.target.value ? Number(e.target.value) : undefined } : s))} placeholder="Delay minutes" />
          <div className="flex gap-2"><Input aria-label="Step details" value={step.description ?? ""} onChange={(e) => setSteps(steps.map((s, i) => i === index ? { ...s, description: e.target.value } : s))} placeholder="Details" /><Button type="button" size="sm" variant="ghost" onClick={() => setSteps(steps.filter((_, i) => i !== index))} disabled={steps.length <= 1}>Remove</Button></div>
        </div>)}<Button type="button" size="sm" variant="outline" onClick={() => setSteps([...steps, { type: "wait", label: "Wait before next step", delayMinutes: 60 }])} disabled={steps.length >= 30}>Add step</Button></div>
        <div className="flex gap-2"><Button size="sm" loading={busy}>{editingId ? "Save changes" : "Create draft"}</Button>{editingId && <Button type="button" size="sm" variant="outline" onClick={resetForm}>Cancel edit</Button>}</div>
      </form></CardContent>
    </Card>

    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Refreshing sequence status…</p>}
    {!sequences.length && !loading && <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No sequences yet. Create a draft above.</p></CardContent></Card>}
    {sequences.map((sequence) => <Card key={sequence.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{sequence.name}</CardTitle><CardDescription>{sequence.description ?? "No description"} · {sequence.status}</CardDescription></div><div className="flex flex-wrap gap-2">
      {sequence.status === "draft" && <Button size="sm" onClick={() => stateChange(sequence, "activate")} disabled={busy}>Activate</Button>}{sequence.status === "active" && <Button size="sm" variant="outline" onClick={() => stateChange(sequence, "pause")} disabled={busy}>Pause</Button>}{sequence.status === "paused" && <><Button size="sm" onClick={() => stateChange(sequence, "resume")} disabled={busy}>Resume</Button><Button size="sm" variant="outline" onClick={() => edit(sequence)} disabled={busy}>Edit</Button></>}{["active", "paused", "draft"].includes(sequence.status) && <Button size="sm" variant="danger" onClick={() => stateChange(sequence, "stop")} disabled={busy}>Stop</Button>}
    </div></div></CardHeader><CardContent className="space-y-3"><ol className="list-inside list-decimal text-sm">{sequence.steps.map((step, i) => <li key={i}>{step.label} <span className="text-muted-foreground">({step.type}{step.delayMinutes ? ` · ${step.delayMinutes}m` : ""})</span></li>)}</ol>
      {sequence.status === "active" && <div className="flex flex-wrap gap-2"><Select aria-label="Choose lead" className="max-w-sm" value={selectedLead[sequence.id] ?? ""} onChange={(e) => setSelectedLead({ ...selectedLead, [sequence.id]: e.target.value })}><option value="">Choose lead to enroll</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.leadNumber} · {lead.fullName}</option>)}</Select><Button size="sm" variant="outline" disabled={busy || !selectedLead[sequence.id]} onClick={() => enroll(sequence)}>Enroll lead</Button></div>}
      {sequence.enrollments.map((enrollment) => <div key={enrollment.id} className="space-y-1 rounded-md border border-border p-3 text-sm"><p>Lead {leads.find((l) => l.id === enrollment.leadId)?.fullName ?? enrollment.leadId} · {enrollment.status} · step {enrollment.currentStep + 1}/{sequence.steps.length}</p>{enrollment.nextRunAt && <p className="text-xs text-muted-foreground">Next eligible: {new Date(enrollment.nextRunAt).toLocaleString()}</p>}{enrollment.status === "active" && sequence.status === "active" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(sequence, enrollment)}>Run next due step</Button>}{enrollment.executions.map((execution) => <p key={execution.id} className="text-xs text-muted-foreground">Step {execution.stepIndex + 1}: {execution.result} · {new Date(execution.executedAt).toLocaleString()}</p>)}</div>)}
    </CardContent></Card>)}
  </div>;
}
