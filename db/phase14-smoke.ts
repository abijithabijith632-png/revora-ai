import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  roles,
  userRoles,
  permissions,
  rolePermissions,
  clients,
  opportunities,
  pipelineStages,
  proposals,
  proposalEvents,
  emailTemplates,
  documents,
  communications,
  emailTrackingEvents,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ProposalService } from "@/server/services/proposals";
import { EmailTemplateService } from "@/server/services/email-templates";
import { DocumentService } from "@/server/services/documents";
import { EmailService } from "@/server/services/emails";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "phase14-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(emailTrackingEvents).where(eq(emailTrackingEvents.organizationId, o.id));
    await db.delete(communications).where(eq(communications.organizationId, o.id));
    await db.delete(documents).where(eq(documents.organizationId, o.id));
    await db.delete(emailTemplates).where(eq(emailTemplates.organizationId, o.id));
    await db.delete(proposalEvents).where(eq(proposalEvents.organizationId, o.id));
    await db.delete(proposals).where(eq(proposals.organizationId, o.id));
    await db.delete(opportunities).where(eq(opportunities.organizationId, o.id));
    await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, o.id));
    await db.delete(clients).where(eq(clients.organizationId, o.id));

    const u = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, o.id));
    for (const row of u) {
      await db.delete(userRoles).where(eq(userRoles.userId, row.id));
      await db.delete(users).where(eq(users.id, row.id));
    }
    const r = await db.select({ id: roles.id }).from(roles).where(eq(roles.organizationId, o.id));
    for (const row of r) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, row.id));
      await db.delete(roles).where(eq(roles.id, row.id));
    }
    await db.delete(organizations).where(eq(organizations.id, o.id));
  }
}

async function seedRoles(orgId: string) {
  await db
    .insert(permissions)
    .values(
      ALL_PERMISSIONS.map((p) => {
        const [resource, action] = p.split(".");
        return { resource, action };
      }),
    )
    .onConflictDoNothing();
  const allPerms = await db.select().from(permissions);
  const permKey = new Map(allPerms.map((p) => [`${p.resource}.${p.action}`, p.id]));

  const roleRows = await db
    .insert(roles)
    .values([
      { organizationId: orgId, name: "Super Admin", isSystem: true },
      { organizationId: orgId, name: "Sales Executive", isSystem: true },
    ])
    .returning();

  for (const r of roleRows) {
    const perms = ROLE_PERMISSION_MATRIX[r.name as keyof typeof ROLE_PERMISSION_MATRIX];
    for (const p of perms) {
      const pid = permKey.get(p);
      if (pid) await db.insert(rolePermissions).values({ roleId: r.id, permissionId: pid });
    }
  }
  return new Map(roleRows.map((r) => [r.name, r.id]));
}

async function main() {
  console.log("[phase14-smoke] Starting Phase 14 commercial layer smoke test...");
  await cleanup();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Phase 14 Smoke", slug: SLUG })
    .returning();
  const byName = await seedRoles(org.id);

  const [admin, exec] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@phase14.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "exec@phase14.test", fullName: "Exec", status: "active" },
    ])
    .returning();

  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: exec.id, roleId: byName.get("Sales Executive")! },
  ]);

  // RBAC
  assert(
    await userHasPermission(admin.id, org.id, "proposals.create"),
    "Super Admin has proposals.create",
  );
  assert(
    !(await userHasPermission(exec.id, org.id, "documents.delete")),
    "Sales Executive lacks documents.delete (least privilege)",
  );

  // Client + pipeline stage + opportunity (for proposal link)
  const [client] = await db
    .insert(clients)
    .values({ organizationId: org.id, companyName: "Proposal Client", clientNumber: "CL-P14", status: "active" })
    .returning();
  const [stage] = await db
    .insert(pipelineStages)
    .values({ organizationId: org.id, name: "New", key: "new", orderIndex: 1, probability: 10, isTerminal: false })
    .returning();
  const [opp] = await db
    .insert(opportunities)
    .values({
      organizationId: org.id,
      clientId: client.id,
      ownerId: admin.id,
      stageId: stage.id,
      name: "Opportunity",
      opportunityNumber: "OPP-P14",
    })
    .returning();

  const actor = { userId: admin.id };
  const proposalService = new ProposalService(org.id);
  const templateService = new EmailTemplateService(org.id);
  const documentService = new DocumentService(org.id);
  const emailService = new EmailService(org.id);

  // ---- Proposals ----
  const proposal = await proposalService.create(actor, {
    opportunityId: opp.id,
    clientId: client.id,
    ownerId: admin.id,
    title: "Proposal",
    amount: 100000,
    status: "draft",
  });
  assert(proposal.status === "draft", "proposal created as draft");

  const sent = await proposalService.changeStatus(actor, proposal.id, { status: "sent" });
  assert(sent?.status === "sent" && sent.sentAt != null, "proposal sent");

  const viewed = await proposalService.changeStatus(actor, proposal.id, { status: "viewed" });
  assert(viewed?.status === "viewed" && viewed.viewCount === 1, "proposal viewed + view count incremented");

  const accepted = await proposalService.changeStatus(actor, proposal.id, { status: "accepted" });
  assert(accepted?.status === "accepted" && accepted.acceptedAt != null, "proposal accepted");

  // Invalid transition (accepted → draft rejected)
  let invalidRejected = false;
  try {
    await proposalService.changeStatus(actor, proposal.id, { status: "draft" });
  } catch (e) {
    invalidRejected = (e as Error).message.includes("cannot move");
  }
  assert(invalidRejected, "invalid proposal transition rejected");

  const proposalWithEvents = await proposalService.getById(proposal.id);
  assert(proposalWithEvents.events.length === 4, "proposal lifecycle events recorded");

  // ---- Email templates ----
  const template = await templateService.create(actor, {
    category: "introduction",
    name: "Intro",
    subject: "Hello",
    body: "Hi {{name}}",
    variables: { name: "string" },
  });
  assert(template.name === "Intro", "email template created");

  const duplicate = await templateService.duplicate(actor, template.id);
  assert(duplicate?.name === "Intro (Copy)", "email template duplicated");

  await templateService.archive(actor, template.id);
  const archived = await templateService.getById(template.id);
  assert(archived.isArchived === true, "email template archived");

  // ---- Documents ----
  const doc = await documentService.create(actor, {
    name: "Contract.pdf",
    documentType: "contract",
    clientId: client.id,
    opportunityId: opp.id,
    fileReference: "local:abc",
    sizeBytes: 1024,
    mimeType: "application/pdf",
    version: 1,
    status: "active",
  });
  assert(doc.name === "Contract.pdf" && doc.version === 1, "document created with version");

  await documentService.archive(actor, doc.id);
  let docArchived = false;
  try {
    await documentService.getById(doc.id);
  } catch (e) {
    docArchived = (e as Error).message.includes("not found");
  }
  assert(docArchived, "document archived and no longer retrievable");

  // ---- Emails ----
  const email = await emailService.record(actor, {
    direction: "outbound",
    recipient: "client@example.com",
    subject: "Proposal follow-up",
    body: "Please review.",
    messageId: "<msg-1@example>",
    threadId: "<thread-1@example>",
    clientId: client.id,
    opportunityId: opp.id,
  });
  assert(email.direction === "outbound", "email record stored");

  await emailService.recordTrackingEvent({
    communicationId: email.id,
    eventType: "open",
  });
  const emailWithTracking = await emailService.getById(email.id);
  assert(emailWithTracking.openedAt != null, "email open tracked (real event)");

  // Send without provider credentials → validation error (honest)
  let providerBlocked = false;
  try {
    await emailService.send(actor, {
      to: ["x@example.com"],
      subject: "Test",
      body: "Test",
    });
  } catch (e) {
    providerBlocked = (e as Error).message.includes("not configured");
  }
  assert(providerBlocked, "email send gated without provider credentials");

  // Tenant isolation
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherService = new ProposalService(orgOther.id);
  let isolated = false;
  try {
    await otherService.getById(proposal.id);
  } catch (e) {
    isolated = (e as Error).message.includes("not found");
  }
  assert(isolated, "cross-tenant proposal access blocked");

  await cleanup();
  console.log("[phase14-smoke] All Phase 14 commercial layer smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[phase14-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
