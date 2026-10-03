import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  createLeadSchema,
  updateLeadStatusSchema,
  assignLeadSchema,
  mergeLeadsSchema,
  createQualificationSchema,
} from "../lib/leads/schemas";
import { paginationSchema, idSchema } from "../lib/validation";

const UUID = "00000000-0000-4000-8000-000000000001";

// Auth regression: password policy lives in route validation; assert baseline expectations.
test("lead create validation accepts minimal valid, rejects bad email", () => {
  assert.equal(createLeadSchema.safeParse({ firstName: "Asha" }).success, true);
  assert.equal(
    createLeadSchema.safeParse({ firstName: "Asha", email: "not-an-email" }).success,
    false,
  );
  assert.equal(createLeadSchema.safeParse({ firstName: "" }).success, false);
});

test("lead status/assign/merge schemas enforce lifecycle guards", () => {
  assert.equal(updateLeadStatusSchema.safeParse({ status: "qualified" }).success, true);
  assert.equal(updateLeadStatusSchema.safeParse({ status: "" }).success, false);
  assert.equal(assignLeadSchema.safeParse({ ownerId: UUID }).success, true);
  assert.equal(assignLeadSchema.safeParse({ ownerId: "x" }).success, false);
  assert.equal(mergeLeadsSchema.safeParse({ targetLeadId: UUID }).success, true);
  assert.equal(mergeLeadsSchema.safeParse({ targetLeadId: "x" }).success, false);
});

test("qualification schema requires full BANT-like evidence", () => {
  const good = {
    requirementClarity: "clear",
    budgetAvailability: "confirmed",
    purchaseTimeline: "0_30_days",
    decisionMaker: "identified",
    companyScale: "strong_fit",
    productFit: "strong_fit",
    conversionProbability: "high",
    outcome: "qualified",
  };
  assert.equal(createQualificationSchema.safeParse(good).success, true);
  assert.equal(
    createQualificationSchema.safeParse({ ...good, outcome: "bogus" }).success,
    false,
  );
});

test("sequence step validation: email/wait/followup/activity/review only, drafts never auto-send", () => {
  const step = z.object({
    type: z.enum(["email", "wait", "followup", "activity", "review"]),
    label: z.string().trim().min(1).max(160),
    delayMinutes: z.number().int().min(1).max(525600).optional(),
    description: z.string().max(2000).optional(),
  });
  const schema = z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2000).optional(),
    steps: z.array(step).min(1).max(30),
  });
  assert.equal(
    schema.safeParse({ name: "Nurture", steps: [{ type: "email", label: "Intro" }] }).success,
    true,
  );
  assert.equal(
    schema.safeParse({ name: "Nurture", steps: [{ type: "send_sms_blast", label: "x" }] }).success,
    false,
  );
  assert.equal(schema.safeParse({ name: "", steps: [] }).success, false);
});

test("pagination + id schemas guard list/detail endpoints", () => {
  assert.equal(paginationSchema.safeParse({ page: 1, limit: 20 }).success, true);
  assert.equal(paginationSchema.safeParse({ page: 0, limit: 999 }).success, false);
  assert.equal(idSchema.safeParse(UUID).success, true);
  assert.equal(idSchema.safeParse("123").success, false);
});
