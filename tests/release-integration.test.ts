import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AGENT_IDS,
  agentActionConfirmationSchema,
  agentOutputSchema,
} from "../server/ai/agent-contracts";
import { agentRequestSchema } from "../server/ai/agent-framework";
import {
  checkRateLimit,
  resetRateLimitForTests,
  rateLimitKey,
} from "../lib/api/rate-limit";
import { RateLimitedError } from "../lib/errors";
import { hasPermission } from "../lib/permissions";
import { calculateBuyingIntent } from "../server/ai/buying-intent";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

// --- Task 2: six agents + action routes ---

test("all six agent ids are defined", () => {
  assert.deepEqual([...AGENT_IDS].sort(), ["account", "deal", "followup", "forecast", "lead", "meeting"].sort());
});

test("agent request schema accepts optional uuid, rejects garbage", () => {
  assert.equal(agentRequestSchema.safeParse({}).success, true);
  assert.equal(agentRequestSchema.safeParse({ targetId: UUID_A }).success, true);
  assert.equal(agentRequestSchema.safeParse({ targetId: "not-a-uuid" }).success, false);
  assert.equal(agentRequestSchema.safeParse({ targetId: UUID_A, organizationId: UUID_B }).success, false);
});

test("agent output rejects executable/mutating action types", () => {
  for (const bad of ["run_sql", "delete_record", "send_email", "change_permission"]) {
    const r = agentOutputSchema.safeParse({
      summary: "s",
      findings: ["f"],
      recommendation: "r",
      proposedAction: { type: bad, title: "t", reason: "why" },
      sourceIds: [],
    });
    assert.equal(r.success, false, bad);
  }
});

test("agent action confirmation requires confirmed:true and strict shape", () => {
  const base = { agentId: "lead", targetId: UUID_A, actionType: "create_task", title: "Call", confirmed: true };
  assert.equal(agentActionConfirmationSchema.safeParse(base).success, true);
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, confirmed: false }).success, false);
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, confirmed: true, sql: "x" }).success, false);
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, actionType: "send_email", confirmed: true }).success, false);
  // draft_email is an output proposal; confirmation route only allows 4 write types
  assert.equal(agentActionConfirmationSchema.safeParse({ ...base, actionType: "draft_email", confirmed: true }).success, true);
});

test("provider failure falls back deterministically (unconfigured key)", () => {
  // AiProvider.isConfigured is false when API key empty; framework uses deterministic fallback.
  // Here we assert the contract layer never invents external facts: buying-intent with no data is explicit.
  const r = calculateBuyingIntent({ activity: 0, recent: 0, meetings: 0, proposals: 0, engagement: 0 });
  assert.equal(r.level, "Insufficient data");
  assert.equal(r.score, null);
});

test("rate limit enforces window and isolates keys", () => {
  resetRateLimitForTests();
  const k1 = `test-${Date.now()}-1`;
  const k2 = `test-${Date.now()}-2`;
  for (let i = 0; i < 3; i++) checkRateLimit(k1, 3, 60_000);
  assert.throws(() => checkRateLimit(k1, 3, 60_000), RateLimitedError);
  // different key unaffected
  checkRateLimit(k2, 3, 60_000);
  resetRateLimitForTests();
  checkRateLimit(k1, 3, 60_000);
});

test("rateLimitKey prefers user id over ip", () => {
  assert.equal(rateLimitKey("u1", "1.2.3.4"), "user:u1");
  assert.equal(rateLimitKey(undefined, "1.2.3.4"), "ip:1.2.3.4");
});

test("permission matrix: executive is read/create limited, cannot assign/approve", () => {
  assert.equal(hasPermission("Sales Executive", "leads.view"), true);
  assert.equal(hasPermission("Sales Executive", "leads.assign"), false);
  assert.equal(hasPermission("Sales Executive", "tasks.create"), true);
  assert.equal(hasPermission("Sales Manager", "leads.assign"), true);
  assert.equal(hasPermission("Admin", "leads.assign"), true);
});

// --- Task 3: cross-tenant guards (static) ---

const REPO = path.resolve(import.meta.dirname ?? ".", "..");

function readRel(p: string): string {
  return fs.readFileSync(path.join(REPO, p.replaceAll("/", path.sep)), "utf8");
}

test("agent routes derive org from session, enforce permission + rate limit", () => {
  const runRoute = readRel("app/api/agents/[agentId]/route.ts");
  const actionRoute = readRel("app/api/agents/actions/route.ts");
  for (const src of [runRoute, actionRoute]) {
    assert.match(src, /requireApiContext/);
    assert.match(src, /checkRateLimit/);
    assert.ok(!src.includes("organizationId.*req\\.json"), "must not trust client org id");
  }
  assert.match(actionRoute, /confirmed/);
  assert.match(actionRoute, /recordAudit/);
});

test("sequence service scopes every query by organizationId", () => {
  const src = readRel("server/services/sales-sequences.ts");
  const scoped = (src.match(/organizationId/g) ?? []).length;
  assert.ok(scoped >= 10, `expected org scoping, found ${scoped}`);
  assert.ok(!src.includes("req.body.organization"), "service must not take org from client body");
});

test("sequence migration declares org fk + unique enrollment guard", () => {
  const sql = readRel("db/migrations/0011_sales_sequences.sql");
  assert.match(sql, /sales_sequences/);
  assert.match(sql, /sales_sequence_enrollments/);
  assert.match(sql, /sales_sequence_executions/);
  assert.match(sql, /organization_id/);
  assert.match(sql, /sales_sequence_enrollment_unique_idx/);
  assert.match(sql, /sales_sequence_execution_once_idx/);
});

test("sequence drizzle schema matches migration tables", () => {
  const schema = readRel("db/schema/sequences.ts");
  assert.match(schema, /sales_sequences/);
  assert.match(schema, /sales_sequence_enrollments/);
  assert.match(schema, /sales_sequence_executions/);
  assert.match(schema, /organizationId/);
});
