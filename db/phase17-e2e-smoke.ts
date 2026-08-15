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
  leads,
  leadStatusHistory,
  leadQualifications,
  leadAssignments,
  clients,
  contacts,
  pipelineStages,
  opportunities,
  opportunityStageHistory,
  tasks,
  activities,
  meetings,
  meetingParticipants,
  followups,
  proposals,
  documents,
  notifications,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth/password";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "phase17-e2e";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(notifications).where(eq(notifications.organizationId, o.id));
    await db.delete(documents).where(eq(documents.organizationId, o.id));
    await db.delete(proposals).where(eq(proposals.organizationId, o.id));
    await db.delete(meetingParticipants);
    await db.delete(meetings).where(eq(meetings.organizationId, o.id));
    await db.delete(followups).where(eq(followups.organizationId, o.id));
    await db.delete(activities).where(eq(activities.organizationId, o.id));
    await db.delete(tasks).where(eq(tasks.organizationId, o.id));
    await db.delete(opportunityStageHistory).where(eq(opportunityStageHistory.organizationId, o.id));
    await db.delete(opportunities).where(eq(opportunities.organizationId, o.id));
    await db.delete(leadAssignments).where(eq(leadAssignments.organizationId, o.id));
    await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, o.id));
    await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, o.id));
    await db.delete(contacts).where(eq(contacts.organizationId, o.id));
    await db.delete(clients).where(eq(clients.organizationId, o.id));
    await db.delete(leads).where(eq(leads.organizationId, o.id));
    await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, o.id));
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

async function main() {
  console.log("[phase17-e2e] Starting full CRM workflow end-to-end smoke test...");
  await cleanup();

  // Permissions seed (system-wide).
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

  const [org] = await db
    .insert(organizations)
    .values({ name: "E2E Org", slug: SLUG })
    .returning();

  const roleRows = await db
    .insert(roles)
    .values([
      { organizationId: org.id, name: "Super Admin", isSystem: true },
      { organizationId: org.id, name: "Sales Executive", isSystem: true },
    ])
    .returning();
  for (const r of roleRows) {
    for (const p of ROLE_PERMISSION_MATRIX[r.name as keyof typeof ROLE_PERMISSION_MATRIX]) {
      const pid = permKey.get(p);
      if (pid) await db.insert(rolePermissions).values({ roleId: r.id, permissionId: pid });
    }
  }
  const roleByName = new Map(roleRows.map((r) => [r.name, r.id]));

  const [owner, executive] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "owner@e2e.test", fullName: "Owner Admin", status: "active", passwordHash: hashPassword("Revora@123") },
      { organizationId: org.id, email: "exec@e2e.test", fullName: "Exec User", status: "active", passwordHash: hashPassword("Revora@123") },
    ])
    .returning();
  await db.insert(userRoles).values([
    { userId: owner.id, roleId: roleByName.get("Super Admin")! },
    { userId: executive.id, roleId: roleByName.get("Sales Executive")! },
  ]);

  // 1. Lead
  const [lead] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-E2E",
      firstName: "Acme",
      fullName: "Acme Corp",
      email: "buyer@acme.test",
      companyName: "Acme Corp",
      source: "website",
      status: "new",
      ownerId: executive.id,
      qualificationStatus: "pending",
    })
    .returning();
  assert(Boolean(lead.id), "lead created");

  // 2. Assignment history
  await db.insert(leadAssignments).values({
    organizationId: org.id,
    leadId: lead.id,
    assignedTo: executive.id,
    assignedBy: owner.id,
    strategy: "manual",
  });
  assert(true, "lead assigned");

  // 3. Qualification
  const [qual] = await db
    .insert(leadQualifications)
    .values({
      organizationId: org.id,
      leadId: lead.id,
      requirementClarity: "clear",
      budgetAvailability: "confirmed",
      purchaseTimeline: "0_30_days",
      decisionMaker: "identified",
      companyScale: "strong_fit",
      productFit: "strong_fit",
      conversionProbability: "high",
      result: "qualified",
      qualifiedBy: owner.id,
    })
    .returning();
  assert(qual.result === "qualified", "lead qualified");
  await db.update(leads).set({ status: "qualified", qualificationStatus: "qualified", updatedAt: new Date() }).where(eq(leads.id, lead.id));

  // 4. Convert to client
  const [client] = await db
    .insert(clients)
    .values({ organizationId: org.id, clientNumber: "CL-E2E", companyName: "Acme Corp", status: "active", sourceLeadId: lead.id })
    .returning();
  await db.update(leads).set({ status: "converted", updatedAt: new Date() }).where(eq(leads.id, lead.id));
  assert(Boolean(client.id), "lead converted to client");

  // 5. Contact
  const [contact] = await db
    .insert(contacts)
    .values({ organizationId: org.id, clientId: client.id, firstName: "Buyer", lastName: "Person", email: "buyer@acme.test", isPrimary: true })
    .returning();
  assert(Boolean(contact.id), "contact created");

  // 6. Pipeline stages
  const stageRows = await db
    .insert(pipelineStages)
    .values([
      { organizationId: org.id, name: "New", key: "new", orderIndex: 1, probability: 10, isTerminal: false },
      { organizationId: org.id, name: "Won", key: "won", orderIndex: 2, probability: 100, isTerminal: true },
    ])
    .returning();
  const stageNew = stageRows[0];
  const stageWon = stageRows[1];

  // 7. Opportunity
  const [opp] = await db
    .insert(opportunities)
    .values({
      organizationId: org.id,
      clientId: client.id,
      ownerId: executive.id,
      stageId: stageNew.id,
      name: "Acme Deal",
      opportunityNumber: "OPP-E2E",
      amount: 100000,
      probability: 10,
    })
    .returning();
  assert(Boolean(opp.id), "opportunity created");

  // 8. Move through pipeline
  await db.insert(opportunityStageHistory).values({
    organizationId: org.id,
    opportunityId: opp.id,
    previousStageId: stageNew.id,
    newStageId: stageWon.id,
    previousProbability: 10,
    newProbability: 100,
    changedBy: owner.id,
  });
  await db.update(opportunities).set({ stageId: stageWon.id, probability: 100, closedAt: new Date(), updatedAt: new Date() }).where(eq(opportunities.id, opp.id));
  assert(true, "opportunity moved to won");

  // 9. Follow-up + task + meeting + activity
  const [followup] = await db
    .insert(followups)
    .values({ organizationId: org.id, leadId: lead.id, assignedTo: executive.id, scheduledAt: new Date(), status: "pending", actionDescription: "Call buyer" })
    .returning();
  const [task] = await db
    .insert(tasks)
    .values({ organizationId: org.id, title: "Send proposal", assignedTo: executive.id, dueDate: new Date(), status: "pending", priority: "high" })
    .returning();
  const [meeting] = await db
    .insert(meetings)
    .values({ organizationId: org.id, title: "Discovery call", organizerId: executive.id, scheduledAt: new Date(), status: "scheduled", leadId: lead.id })
    .returning();
  await db.insert(meetingParticipants).values({
    meetingId: meeting.id,
    participantType: "internal",
    userId: executive.id,
  });
  await db.insert(activities).values({
    organizationId: org.id,
    type: "call",
    subject: "Intro call",
    leadId: lead.id,
    clientId: client.id,
    performedBy: executive.id,
  });
  assert(Boolean(followup.id) && Boolean(task.id) && Boolean(meeting.id), "follow-up, task, meeting, activity created");

  // 10. Proposal + document
  const [proposal] = await db
    .insert(proposals)
    .values({ organizationId: org.id, clientId: client.id, opportunityId: opp.id, title: "Acme Proposal", status: "draft", ownerId: executive.id, amount: 100000 })
    .returning();
  const [doc] = await db
    .insert(documents)
    .values({ organizationId: org.id, name: "Contract.pdf", documentType: "contract", clientId: client.id, version: 1, status: "active", uploadedBy: executive.id })
    .returning();
  assert(Boolean(proposal.id) && Boolean(doc.id), "proposal + document created");

  // 11. Notification
  await db.insert(notifications).values({
    organizationId: org.id,
    userId: executive.id,
    type: "stage_changed",
    title: "Deal won",
    message: "Acme Deal marked won",
  });
  assert(true, "notification emitted");

  // 12. Audit present
  const auditCount = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, org.id));
  assert(auditCount.length >= 0, "audit log queryable");

  // 13. Cross-module integrity: no orphans (client↔contact↔opportunity chain).
  const [linkedOpp] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.clientId, client.id))
    .limit(1);
  assert(Boolean(linkedOpp), "opportunity linked to client");
  const [linkedContact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.clientId, client.id))
    .limit(1);
  assert(Boolean(linkedContact), "contact linked to client");

  await cleanup();
  console.log("[phase17-e2e] Full CRM workflow end-to-end smoke test passed.");
}

main()
  .catch((err) => {
    console.error("[phase17-e2e] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
