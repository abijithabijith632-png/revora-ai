import test from "node:test";
import assert from "node:assert/strict";
import { agentActionConfirmationSchema, agentOutputSchema } from "../server/ai/agent-contracts";

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
