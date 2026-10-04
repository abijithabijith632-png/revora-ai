import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { agentActionConfirmationSchema, agentOutputSchema } from "../server/ai/agent-contracts";
import { AiProvider, AiProviderUnavailableError } from "../server/ai/provider";
import { sanitizeAuditValue } from "../lib/api/audit";
import { paymentProvider } from "../server/billing/provider";

const repo = path.resolve(import.meta.dirname ?? ".", "..");

test("agent contract accepts typed recommendation with approved action", () => {
  const result = agentOutputSchema.safeParse({
    summary: "The lead has recent activity.",
    findings: ["Two calls were recorded."],
    recommendation: "Schedule a follow-up.",
    proposedAction: { type: "create_followup", title: "Call lead", reason: "Recent calls need a response." },
    sourceIds: ["00000000-0000-4000-8000-000000000001"],
  });
  assert.equal(result.success, true);
});

test("agent contract rejects malformed output and arbitrary executable fields", () => {
  const result = agentOutputSchema.safeParse({
    summary: "Answer",
    findings: [],
    recommendation: "Review",
    proposedAction: { type: "run_sql", title: "Delete", reason: "No" },
    sourceIds: [],
    sql: "DROP TABLE leads",
  });
  assert.equal(result.success, false);
});

test("write action requires explicit confirmation and rejects unrecognized action fields", () => {
  const base = { agentId: "lead", targetId: "00000000-0000-4000-8000-000000000001", actionType: "create_task", title: "Call lead" };
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, confirmed: true }).success, true);
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, confirmed: false }).success, false);
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, confirmed: true, sql: "UPDATE users" }).success, false);
});

test("unconfigured AI provider rejects instead of returning a generated result", async () => {
  const provider = new AiProvider({ baseUrl: "https://invalid.example", apiKey: "", model: "test" });
  await assert.rejects(provider.generateStructured({ system: "system", user: "user" }), AiProviderUnavailableError);
});

test("agent and Copilot services do not turn provider failures into successful fallback answers", () => {
  const agent = fs.readFileSync(path.join(repo, "server", "ai", "agent-framework.ts"), "utf8");
  const copilot = fs.readFileSync(path.join(repo, "server", "services", "ai-copilot.ts"), "utf8");
  assert.match(agent, /AiProviderUnavailableError/);
  assert.doesNotMatch(agent, /deterministic_provider_fallback/);
  assert.match(copilot, /AiProviderUnavailableError/);
  assert.doesNotMatch(copilot, /deterministic_crm_fallback/);
});

test("AI email drafting applies executive ownership filters to CRM records", () => {
  const source = fs.readFileSync(path.join(repo, "server", "services", "email-draft.ts"), "utf8");
  assert.match(source, /eq\(leads\.ownerId, actor\.userId\)/);
  assert.match(source, /eq\(opportunities\.ownerId, actor\.userId\)/);
  assert.match(source, /eq\(clients\.accountManagerId, actor\.userId\)/);
});

test("audit values redact nested credentials and payment provider remains unavailable without a real adapter", () => {
  assert.deepEqual(sanitizeAuditValue({ nested: { apiKey: "secret", label: "safe" } }), {
    nested: { apiKey: "[REDACTED]", label: "safe" },
  });
  assert.equal(paymentProvider.isConfigured(), false);
});
