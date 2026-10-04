"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, FormField, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { EMAIL_TEMPLATE_CATEGORIES, emailTemplateCategoryLabel } from "@/lib/commercial/presentation";
import { useToast } from "@/components/ui/toast";

type Template = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: unknown;
  isArchived: boolean;
};

type Draft = Omit<Template, "id" | "isArchived">;
const EMPTY: Draft = { name: "", category: "introduction", subject: "", body: "", variables: {} };
const SAMPLES: Array<{ name: string; category: Draft["category"]; subject: string; body: string }> = [
  { name: "Introduction", category: "introduction", subject: "Introduction, {{company_name}}", body: "Hi {{contact_name}},\n\nI’m reaching out to introduce our team and learn about your priorities at {{company_name}}.\n\nWould you be available for a brief conversation?\n\nBest,\n{{sender_name}}" },
  { name: "Meeting confirmation", category: "meeting_confirmation", subject: "Our meeting on {{meeting_date}}", body: "Hi {{contact_name}},\n\nThis confirms our meeting on {{meeting_date}} at {{meeting_time}}.\n\nLooking forward to speaking with you.\n{{sender_name}}" },
  { name: "Follow-up", category: "follow_up", subject: "Following up: {{topic}}", body: "Hi {{contact_name}},\n\nI wanted to follow up on {{topic}}. Please let me know if you have any questions or would like to discuss next steps.\n\nBest,\n{{sender_name}}" },
];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json?.error?.message ?? `Request failed (${response.status}).`);
  return json.data as T;
}

export function EmailTemplateManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [variablesText, setVariablesText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstFilterEffect = useRef(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20", sortBy: "name", sortOrder: "asc", archived: String(showArchived) });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    try {
      const response = await fetch(`/api/email-templates?${params}`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? `Request failed (${response.status}).`);
      setTemplates(json.data as Template[]);
      setTotalPages(Math.max(1, Number(json.meta?.totalPages ?? 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load templates.");
    }
  }, [category, page, search, showArchived]);

  useEffect(() => {
    if (firstFilterEffect.current) { firstFilterEffect.current = false; return; }
    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function startCreate(sample?: (typeof SAMPLES)[number]) {
    const next = sample ? { ...sample, variables: {} } : { ...EMPTY };
    setEditing(null);
    setDraft(next);
    setVariablesText(sample ? [...new Set(`${sample.subject}\n${sample.body}`.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)?.map((token) => token.replace(/[{}\s]/g, "")) ?? [])].join(", ") : "");
    setError("");
    setOpen(true);
  }

  function startEdit(template: Template) {
    setEditing(template);
    const variables = template.variables && typeof template.variables === "object" && !Array.isArray(template.variables)
      ? template.variables as Record<string, unknown>
      : {};
    setDraft({ name: template.name, category: template.category, subject: template.subject, body: template.body, variables: Object.fromEntries(Object.entries(variables).filter(([, value]) => typeof value === "string")) as Record<string, string> });
    setVariablesText(Object.keys(variables).join(", "));
    setError("");
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const variableNames = [...new Set(variablesText.split(",").map((v) => v.trim().replace(/^\{\{?|\}?\}$/g, "")).filter(Boolean))];
    const payload = { ...draft, variables: Object.fromEntries(variableNames.map((v) => [v, ""])) };
    try {
      const saved = await request<Template>(editing ? `/api/email-templates/${editing.id}` : "/api/email-templates", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      toast({ variant: "success", title: editing ? "Template updated." : "Template created." });
      setOpen(false);
      setSearch(""); setCategory(""); setShowArchived(false); setPage(1);
      setTemplates((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save template."); }
    finally { setBusy(false); }
  }

  async function archive(template: Template) {
    if (!window.confirm(`Deactivate “${template.name}”?`)) return;
    try {
      await request(`/api/email-templates/${template.id}`, { method: "DELETE" });
      toast({ variant: "success", title: "Template deactivated." }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not deactivate template."); }
  }

  async function duplicate(template: Template) {
    try {
      await request(`/api/email-templates/${template.id}/duplicate`, { method: "POST" });
      toast({ variant: "success", title: "Template duplicated." }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not duplicate template."); }
  }

  const visible = templates.filter((t) => t.isArchived === showArchived);
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Search templates" htmlFor="template-search"><Input id="template-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name or subject" /></FormField>
        <FormField label="Category" htmlFor="template-category"><Select id="template-category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{EMAIL_TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{emailTemplateCategoryLabel(c)}</option>)}</Select></FormField>
        <FormField label="View" htmlFor="template-archive"><Select id="template-archive" value={showArchived ? "archived" : "active"} onChange={(e) => { setShowArchived(e.target.value === "archived"); setPage(1); }}><option value="active">Active</option><option value="archived">Deactivated</option></Select></FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Create from sample" defaultValue="" onChange={(e) => { const sample = SAMPLES[Number(e.target.value)]; if (sample) startCreate(sample); e.target.value = ""; }} className="w-auto"><option value="">Sample template…</option>{SAMPLES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</Select>
        <Button onClick={() => startCreate()}>New template</Button>
      </div>
    </div>
    {error && !open && <p role="alert" className="text-sm text-danger">{error}</p>}
    {visible.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No {showArchived ? "deactivated" : "active"} email templates match these filters.</Card> :
      <><div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{visible.map((template) => <Card key={template.id} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-foreground">{template.name}</h2><p className="text-sm text-muted-foreground">{emailTemplateCategoryLabel(template.category)}</p></div><span className="rounded-full border border-border px-2 py-1 text-xs">{template.isArchived ? "Deactivated" : "Active"}</span></div>
        <p className="break-words text-sm"><span className="font-medium">Subject:</span> {template.subject}</p>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{template.body}</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => startEdit(template)}>Edit</Button><Button size="sm" variant="secondary" onClick={() => void duplicate(template)}>Duplicate</Button>{!template.isArchived && <Button size="sm" variant="ghost" onClick={() => void archive(template)}>Deactivate</Button>}</div>
      </Card>)}</div><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></>}
    <Modal open={open} onClose={() => !busy && setOpen(false)} title={editing ? "Edit email template" : "New email template"} description="Variables use {{variable_name}} tokens. Creating a sample does not send email." className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <form onSubmit={save} className="space-y-4">
        <FormField label="Name" htmlFor="template-name" required><Input id="template-name" required maxLength={255} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></FormField>
        <FormField label="Category" htmlFor="template-category-edit" required><Select id="template-category-edit" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{EMAIL_TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{emailTemplateCategoryLabel(c)}</option>)}</Select></FormField>
        <FormField label="Subject" htmlFor="template-subject" required><Input id="template-subject" required maxLength={255} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></FormField>
        <FormField label="Body" htmlFor="template-body" required><Textarea id="template-body" required rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></FormField>
        <FormField label="Dynamic variables (comma-separated names)" htmlFor="template-variables"><Input id="template-variables" value={variablesText} onChange={(e) => setVariablesText(e.target.value)} placeholder="contact_name, company_name, sender_name" /><span className="text-xs text-muted-foreground">Add the matching tokens in subject or body, for example {"{{contact_name}}"}.</span></FormField>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy}>{editing ? "Save changes" : "Create template"}</Button></div>
      </form>
    </Modal>
  </div>;
}
