import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProposalSchema,
  updateProposalSchema,
  createEmailTemplateSchema,
} from "../lib/commercial/schemas";
import {
  assignLeadSchema,
  autoAssignLeadSchema,
} from "../lib/leads/schemas";
import {
  createMeetingSchema,
  createTaskSchema,
  updateTaskSchema,
  createActivitySchema,
} from "../lib/operations/schemas";

const REPO = path.resolve(import.meta.dirname ?? ".", "..");
const UUID = "00000000-0000-4000-8000-000000000001";

function readRel(p: string): string {
  return fs.readFileSync(path.join(REPO, p.replaceAll("/", path.sep)), "utf8");
}

// --- Proposals: opportunity is required; standalone creation must include it ---
test("proposal create requires an opportunity, accepts valid payload", () => {
  assert.equal(
    createProposalSchema.safeParse({ title: "Q3 Proposal" }).success,
    false,
  );
  assert.equal(
    createProposalSchema.safeParse({ title: "Q3 Proposal", opportunityId: UUID }).success,
    true,
  );
  assert.equal(
    createProposalSchema.safeParse({ title: "", opportunityId: UUID }).success,
    false,
  );
  assert.equal(
    updateProposalSchema.safeParse({ title: "Renamed" }).success,
    true,
  );
});

// --- Assignments: manual assign + unassign (null owner) contracts ---
test("assignment schemas support manual assign and unassign", () => {
  assert.equal(
    assignLeadSchema.safeParse({ ownerId: UUID, strategy: "manual" }).success,
    true,
  );
  assert.equal(
    assignLeadSchema.safeParse({ ownerId: null, strategy: "manual" }).success,
    true,
  );
  assert.equal(
    assignLeadSchema.safeParse({ ownerId: "not-a-uuid" }).success,
    false,
  );
  assert.equal(
    autoAssignLeadSchema.safeParse({ strategy: "round_robin" }).success,
    true,
  );
  assert.equal(
    autoAssignLeadSchema.safeParse({ strategy: "manual" }).success,
    false,
  );
});

// --- Meetings/tasks/activities: required-field validation ---
test("meeting/task/activity schemas enforce required fields", () => {
  assert.equal(
    createMeetingSchema.safeParse({ title: "Sync", scheduledAt: new Date().toISOString() })
      .success,
    true,
  );
  assert.equal(
    createMeetingSchema.safeParse({ title: "Sync", scheduledAt: "not-a-date" }).success,
    false,
  );
  assert.equal(createTaskSchema.safeParse({ title: "Call back" }).success, true);
  assert.equal(createTaskSchema.safeParse({ title: "" }).success, false);
  assert.equal(updateTaskSchema.safeParse({ status: "completed" }).success, true);
  assert.equal(
    createActivitySchema.safeParse({ type: "call", subject: "Intro" }).success,
    true,
  );
  assert.equal(
    createActivitySchema.safeParse({ type: "bogus" }).success,
    false,
  );
});

test("email templates validate required fields and category", () => {
  assert.equal(createEmailTemplateSchema.safeParse({
    name: "Welcome", category: "introduction", subject: "Hello", body: "Hi {{name}}",
    variables: { name: "" },
  }).success, true);
  assert.equal(createEmailTemplateSchema.safeParse({
    name: "", category: "introduction", subject: "Hello", body: "Body",
  }).success, false);
  assert.equal(createEmailTemplateSchema.safeParse({
    name: "Welcome", category: "unknown", subject: "Hello", body: "Body",
  }).success, false);
});

test("core workflows retain tenant-scoped relationships and guarded navigation", () => {
  const activities = readRel("server/services/activities.ts");
  const tasks = readRel("server/services/tasks.ts");
  const meetingList = readRel("components/operations/meeting-list.tsx");
  const meetingDetail = readRel("app/(app)/meetings/[id]/page.tsx");
  const roleService = readRel("lib/permissions/rbac-service.ts");
  assert.match(activities, /validateRelations/);
  assert.match(activities, /leads\.organizationId/);
  assert.match(activities, /contacts\.organizationId/);
  assert.match(tasks, /validateRelations/);
  assert.match(tasks, /opportunities\.organizationId/);
  assert.match(meetingList, /timeZone: "UTC"/);
  assert.doesNotMatch(meetingList, /suppressHydrationWarning/);
  assert.match(meetingDetail, /error instanceof NotFoundError/);
  assert.match(roleService, /Cannot remove the last active administrator role/);
});

test("email template page exposes create, edit, duplicate, archive and filtering actions", () => {
  const manager = readRel("components/commercial/email-template-manager.tsx");
  const service = readRel("server/services/email-templates.ts");
  assert.match(manager, /New template/);
  assert.match(manager, /Edit email template/);
  assert.match(manager, /Duplicate/);
  assert.match(manager, /Deactivate/);
  assert.match(manager, /Sample template/);
  assert.match(service, /findActiveByName/);
  assert.match(service, /ConflictError/);
});

// --- Notifications: dismiss route + meeting remind route exist ---
test("notification dismiss and meeting remind routes exist with auth", () => {
  const del = readRel("app/api/notifications/[id]/route.ts");
  assert.match(del, /export async function DELETE/);
  assert.match(del, /notifications\.view/);
  assert.match(del, /service\.remove/);

  const remind = readRel("app/api/meetings/[id]/remind/route.ts");
  assert.match(remind, /export async function POST/);
  assert.match(remind, /sendReminders/);
});

// --- Audit: filters + CSV + timezone display ---
test("audit API supports filters, CSV export, and org-timezone display", () => {
  const src = readRel("app/api/audit-logs/route.ts");
  for (const param of ["search", "action", "actor", "entityType", "from", "to"]) {
    assert.ok(src.includes(`"${param}"`), `missing filter ${param}`);
  }
  assert.match(src, /format.*csv/);
  assert.match(src, /previousValue/);
  assert.match(src, /newValue/);
  assert.match(src, /timeZone/);
});

// --- Analytics: range param + new aggregates wired ---
test("analytics dashboard supports ranges and new chart datasets", () => {
  const src = readRel("app/api/analytics/dashboard/route.ts");
  assert.match(src, /days/);
  assert.match(src, /opportunitiesOverTime/);
  assert.match(src, /leadsByStatus/);
  assert.match(src, /aiScoreDistribution/);
});

// --- Performance: no list refetches its server-provided rows on mount ---
test("all data lists skip the duplicate mount fetch", () => {
  const lists = [
    "components/leads/lead-table.tsx",
    "components/clients/client-table.tsx",
    "components/clients/contact-table.tsx",
    "components/opportunities/opportunity-table.tsx",
    "components/operations/task-list.tsx",
    "components/operations/meeting-list.tsx",
    "components/operations/followup-list.tsx",
    "components/commercial/proposal-table.tsx",
    "components/commercial/document-list.tsx",
  ];
  for (const f of lists) {
    const src = readRel(f);
    assert.ok(src.includes("fetchedKey"), `${f} missing mount-fetch dedup`);
  }
});

// --- AI: provider failures are meaningful AppErrors, not generic 500s ---
test("AI provider maps failures to actionable errors", () => {
  const src = readRel("server/ai/provider.ts");
  assert.match(src, /AiProviderError/);
  assert.ok(!src.includes("throw new Error(\n          `AI provider error"));
});
