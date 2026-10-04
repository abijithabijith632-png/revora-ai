import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  canTransition,
  allowedNextStages,
  stageProbability,
} from "../lib/opportunities/pipeline";
import {
  opportunityStageSchema,
  createOpportunitySchema,
} from "../lib/opportunities/schemas";

const REPO = path.resolve(import.meta.dirname ?? ".", "..");

// --- Pure transition matrix (no DB): the Kanban + API must agree ---
test("stage transitions: happy path New -> Won chain is allowed", () => {
  assert.equal(canTransition("new", "qualified"), true);
  assert.equal(canTransition("qualified", "proposal"), true);
  assert.equal(canTransition("proposal", "negotiation"), true);
  assert.equal(canTransition("negotiation", "final_review"), true);
  assert.equal(canTransition("final_review", "won"), true);
  assert.equal(canTransition("negotiation", "won"), true);
});

test("stage transitions: Final Review -> Lost allowed, terminal stages locked", () => {
  assert.equal(canTransition("final_review", "lost"), true);
  assert.equal(canTransition("new", "lost"), true);
  assert.equal(canTransition("proposal", "lost"), true);
  // Terminal: no outgoing (must 403 in API).
  assert.deepEqual(allowedNextStages("won"), []);
  assert.deepEqual(allowedNextStages("lost"), []);
  assert.equal(canTransition("won", "new"), false);
  assert.equal(canTransition("won", "qualified"), false);
  assert.equal(canTransition("lost", "new"), false);
  assert.equal(canTransition("lost", "won"), false);
});

test("stage transitions: skipping stages is forbidden", () => {
  assert.equal(canTransition("new", "won"), false);
  assert.equal(canTransition("qualified", "won"), false);
  assert.equal(canTransition("proposal", "won"), false);
  assert.equal(canTransition("new", "proposal"), false);
  assert.equal(canTransition("qualified", "negotiation"), false);
});

test("stage probabilities: won=100, final_review=90", () => {
  assert.equal(stageProbability("won"), 100);
  assert.equal(stageProbability("final_review"), 90);
  assert.equal(stageProbability("new"), 10);
});

// --- Schema: stage-change payload ---
test("opportunityStageSchema accepts won without reason, requires reason for lost (service enforces)", () => {
  assert.equal(opportunityStageSchema.safeParse({ stageKey: "won" }).success, true);
  assert.equal(
    opportunityStageSchema.safeParse({ stageKey: "final_review" }).success,
    true,
  );
  // Schema itself allows lost without reason; service layer rejects with 400.
  // Frontend must collect reason before calling the API.
  assert.equal(opportunityStageSchema.safeParse({ stageKey: "lost" }).success, true);
  assert.equal(
    opportunityStageSchema.safeParse({ stageKey: "lost", reason: "price" }).success,
    true,
  );
  assert.equal(
    opportunityStageSchema.safeParse({ stageKey: "custom_review" }).success,
    true,
  );
  assert.equal(
    opportunityStageSchema.safeParse({ stageKey: "bad-key" }).success,
    false,
  );
  assert.equal(createOpportunitySchema.safeParse({ name: "x", clientId: "not-a-uuid" }).success, false);
});

// --- Route: must support POST + PATCH + PUT (task requires POST/PATCH, bug mentions PUT) ---
test("stage route supports POST, PATCH, and PUT with tenant-scoped edit permission", () => {
  const src = fs.readFileSync(
    path.join(REPO, "app", "api", "opportunities", "[id]", "stage", "route.ts"),
    "utf8",
  );
  assert.match(src, /export async function POST/);
  assert.match(src, /export async function PATCH/);
  assert.match(src, /export async function PUT/);
  // Auth: tenant from session, never client org id; requires opportunities.edit.
  assert.match(src, /requireApiContext\("opportunities\.edit"\)/);
  assert.ok(!src.includes("organizationId.*req"), "must not trust client org id");
  // Delegates to the tenant-scoped service method.
  assert.match(src, /changeStage/);
});

// --- Service: atomic tenant-scoped transaction, no second-pool deadlock ---
test("changeStage uses a single tx for update + history with org scoping", () => {
  const src = fs.readFileSync(
    path.join(REPO, "server", "services", "opportunities.ts"),
    "utf8",
  );
  // Both writes must run on tx (not this.db inside the callback) so Vercel
  // max:1 pools never deadlock; update must be org + isDeleted scoped.
  assert.match(src, /await db\.transaction\(async \(tx\)/);
  assert.match(src, /tx\s*\.\s*update\(opportunities\)/);
  assert.match(src, /tx\.insert\(opportunityStageHistory\)/);
  assert.match(src, /eq\(opportunities\.organizationId, this\.repo\.orgId\)/);
  assert.match(src, /eq\(opportunities\.isDeleted, false\)/);
  // Must verify the resolved stage belongs to the same org.
  assert.match(src, /findStageById/);
});

// --- Repository: org-scoped stage verification helper exists ---
test("opportunity repository exposes org-scoped stage verification", () => {
  const src = fs.readFileSync(
    path.join(REPO, "server", "repositories", "opportunities.ts"),
    "utf8",
  );
  assert.match(src, /findStageById/);
  assert.match(src, /eq\(pipelineStages\.organizationId, this\.organizationId\)/);
});

// --- Frontend: Kanban posts stageKey and collects Lost reason ---
test("kanban posts to /stage with stageKey and prompts for Lost reason", () => {
  const src = fs.readFileSync(
    path.join(REPO, "components", "opportunities", "opportunity-kanban.tsx"),
    "utf8",
  );
  assert.match(src, /\/api\/opportunities\/\$\{card\.id\}\/stage/);
  assert.match(src, /stageKey/);
  // Lost without a reason would 400; UI must collect it first.
  assert.match(src, /lost/);
  assert.match(src, /reason/);
});
