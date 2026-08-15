import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../index";
import { hashPassword } from "@/lib/auth/password";
import {
  ROLE_PERMISSION_MATRIX,
  ROLE_NAMES,
} from "@/lib/permissions";
import {
  organizations,
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  leads,
  leadQualifications,
  leadAssignments,
  leadStatusHistory,
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
  notifications,
  userNotificationPreferences,
  aiInsights,
  organizationSettings,
  plans,
  subscriptions,
} from "../schema";

/**
 * Development-only seed.
 *
 * Creates a clearly-labeled fictional organization with consistent relational
 * data across the domain. Safe to re-run (uses `onConflictDoNothing` and
 * clears the tenant's rows first for idempotency). No real people / sensitive
 * data. Not used to present unfinished functionality as complete.
 */

async function resetTenant(orgId: string) {
  // Delete in dependency-safe order for idempotent re-seeding.
  await db.delete(aiInsights).where(eq(aiInsights.organizationId, orgId));
  await db.delete(opportunityStageHistory).where(eq(opportunityStageHistory.organizationId, orgId));
  await db.delete(opportunities).where(eq(opportunities.organizationId, orgId));
  await db.delete(notifications).where(eq(notifications.organizationId, orgId));
  await db.delete(userNotificationPreferences).where(eq(userNotificationPreferences.organizationId, orgId));
  await db.delete(meetingParticipants);
  await db.delete(meetings).where(eq(meetings.organizationId, orgId));
  await db.delete(followups).where(eq(followups.organizationId, orgId));
  await db.delete(activities).where(eq(activities.organizationId, orgId));
  await db.delete(tasks).where(eq(tasks.organizationId, orgId));
  await db.delete(leadAssignments).where(eq(leadAssignments.organizationId, orgId));
  await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, orgId));
  await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, orgId));
  await db.delete(contacts).where(eq(contacts.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(leads).where(eq(leads.organizationId, orgId));
  await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, orgId));
  await db.delete(userRoles);
  await db.delete(rolePermissions);
  await db.delete(roles).where(eq(roles.organizationId, orgId));
  await db.delete(users).where(eq(users.organizationId, orgId));
  await db.delete(organizationSettings).where(eq(organizationSettings.organizationId, orgId));
}

async function main() {
  console.log("[seed] Starting development seed...");

  const [org] = await db
    .insert(organizations)
    .values({
      name: "Revora Demo (Development Only)",
      slug: "revora-demo-dev",
      status: "active",
      timezone: "UTC",
      currency: "INR",
    })
    .onConflictDoNothing()
    .returning();

  if (!org) {
    console.log("[seed] Demo organization already exists.");
    return;
  }

  // Idempotency: wipe any prior seed rows for this tenant.
  await resetTenant(org.id);

  // ---- Users (demo password: "Revora@123" — development only) ----
  const demoPasswordHash = hashPassword("Revora@123");
  const [adminUser, managerUser, salesUser] = await db
    .insert(users)
    .values([
      {
        organizationId: org.id,
        email: "admin@revora.local",
        fullName: "Aarav Admin",
        jobTitle: "Super Admin",
        status: "active",
        passwordHash: demoPasswordHash,
        emailVerifiedAt: new Date(),
      },
      {
        organizationId: org.id,
        email: "manager@revora.local",
        fullName: "Meera Manager",
        jobTitle: "Sales Manager",
        status: "active",
        passwordHash: demoPasswordHash,
        emailVerifiedAt: new Date(),
      },
      {
        organizationId: org.id,
        email: "executive@revora.local",
        fullName: "Rohan Executive",
        jobTitle: "Sales Executive",
        status: "active",
        passwordHash: demoPasswordHash,
        emailVerifiedAt: new Date(),
      },
    ])
    .returning();

  // ---- Roles + permissions (canonical matrix) ----
  const roleRows = await db
    .insert(roles)
    .values(
      ROLE_NAMES.map((name) => ({
        organizationId: org.id,
        name,
        isSystem: true,
      })),
    )
    .returning();

  // Ensure the full permission vocabulary exists.
  await db
    .insert(permissions)
    .values(
      (
        await import("@/lib/permissions").then((m) => m.ALL_PERMISSIONS)
      ).map((p) => {
        const [resource, action] = p.split(".");
        return { resource, action };
      }),
    )
    .onConflictDoNothing();

  const allPermRows = await db.select().from(permissions);
  const permKey = new Map(
    allPermRows.map((p) => [`${p.resource}.${p.action}`, p.id]),
  );

  for (const role of roleRows) {
    const perms = ROLE_PERMISSION_MATRIX[role.name as (typeof ROLE_NAMES)[number]];
    if (!perms) continue;
    for (const p of perms) {
      const permissionId = permKey.get(p);
      if (permissionId) {
        await db.insert(rolePermissions).values({ roleId: role.id, permissionId });
      }
    }
  }

  const roleByName = new Map(roleRows.map((r) => [r.name, r.id]));
  await db.insert(userRoles).values([
    { userId: adminUser.id, roleId: roleByName.get("Super Admin")! },
    { userId: managerUser.id, roleId: roleByName.get("Sales Manager")! },
    { userId: salesUser.id, roleId: roleByName.get("Sales Executive")! },
  ]);

  await db.insert(organizationSettings).values({
    organizationId: org.id,
    timezone: "UTC",
    currency: "INR",
    notificationPreferences: { email: true, inApp: true },
    aiPreferences: { explainability: true },
    integrationPreferences: {},
  });

  // ---- SaaS plans + subscription (Phase 16) ----
  await db
    .insert(plans)
    .values([
      { name: "FREE", description: "Free plan", priceMonthly: null, limits: { userSeats: 2, leadStorage: 100, aiUsage: 20 }, isActive: true },
      { name: "STARTER", description: "Starter plan", priceMonthly: 29, limits: { userSeats: 10, leadStorage: 5000, aiUsage: 500 }, isActive: true },
      { name: "PROFESSIONAL", description: "Professional plan", priceMonthly: 99, limits: { userSeats: 50, leadStorage: 50000, aiUsage: 5000 }, isActive: true },
      { name: "ENTERPRISE", description: "Enterprise plan", priceMonthly: 499, limits: { userSeats: null, leadStorage: null, aiUsage: null }, isActive: true },
    ])
    .onConflictDoNothing();
  const [proPlan] = await db.select().from(plans).where(eq(plans.name, "PROFESSIONAL")).limit(1);
  if (proPlan) {
    await db
      .insert(subscriptions)
      .values({ organizationId: org.id, planId: proPlan.id, status: "active" })
      .onConflictDoNothing();
  }

  // ---- Pipeline stages ----
  const stageRows = await db
    .insert(pipelineStages)
    .values([
      { organizationId: org.id, name: "New", key: "new", orderIndex: 1, probability: 10, isTerminal: false },
      { organizationId: org.id, name: "Qualified", key: "qualified", orderIndex: 2, probability: 30, isTerminal: false },
      { organizationId: org.id, name: "Proposal", key: "proposal", orderIndex: 3, probability: 60, isTerminal: false },
      { organizationId: org.id, name: "Negotiation", key: "negotiation", orderIndex: 4, probability: 80, isTerminal: false },
      { organizationId: org.id, name: "Won", key: "won", orderIndex: 5, probability: 100, isTerminal: true },
      { organizationId: org.id, name: "Lost", key: "lost", orderIndex: 6, probability: 0, isTerminal: true },
    ])
    .returning();
  const [stageNew, stageQualified, stageProposal] = stageRows;

  // ---- Leads ----
  const leadRows = await db
    .insert(leads)
    .values([
      {
        organizationId: org.id,
        leadNumber: "LD-1001",
        firstName: "Nisha",
        lastName: "Kapoor",
        fullName: "Nisha Kapoor",
        email: "nisha.kapoor@acme.example",
        phone: "+91 90000 10001",
        companyName: "Acme Industries",
        industry: "Manufacturing",
        companySize: "201-500",
        geography: "Mumbai",
        website: "https://acme.example",
        source: "website",
        status: "qualified",
        ownerId: salesUser.id,
        // AI fields left null — no fabricated AI scores.
        qualificationStatus: "qualified",
      },
      {
        organizationId: org.id,
        leadNumber: "LD-1002",
        firstName: "Vikram",
        lastName: "Rao",
        fullName: "Vikram Rao",
        email: "vikram.rao@nimbus.example",
        phone: "+91 90000 10002",
        companyName: "Nimbus Tech",
        industry: "Technology",
        companySize: "51-200",
        geography: "Bengaluru",
        website: "https://nimbus.example",
        source: "referral",
        status: "contacted",
        ownerId: managerUser.id,
        qualificationStatus: "needs_nurture",
      },
      {
        organizationId: org.id,
        leadNumber: "LD-1003",
        firstName: "Priya",
        lastName: "Shah",
        fullName: "Priya Shah",
        email: "priya.shah@vertex.example",
        phone: "+91 90000 10003",
        companyName: "Vertex Retail",
        industry: "Retail",
        companySize: "501-1000",
        geography: "Delhi",
        website: "https://vertex.example",
        source: "google_search",
        status: "new",
        ownerId: salesUser.id,
        qualificationStatus: "pending",
      },
    ])
    .returning();
  const [lead1, lead2, lead3] = leadRows;

  // Seed status history (foundation for Phase 7 status timeline).
  await db.insert(leadStatusHistory).values([
    {
      organizationId: org.id,
      leadId: lead1.id,
      fromStatus: null,
      toStatus: "qualified",
      changedBy: salesUser.id,
    },
    {
      organizationId: org.id,
      leadId: lead2.id,
      fromStatus: null,
      toStatus: "contacted",
      changedBy: managerUser.id,
    },
    {
      organizationId: org.id,
      leadId: lead3.id,
      fromStatus: null,
      toStatus: "new",
      changedBy: salesUser.id,
    },
  ]);

  await db.insert(leadQualifications).values([
    {
      organizationId: org.id,
      leadId: lead1.id,
      requirementClarity: "clear",
      budgetAvailability: "confirmed",
      purchaseTimeline: "0_30_days",
      decisionMaker: "identified",
      companyScale: "strong_fit",
      productFit: "strong_fit",
      conversionProbability: "high",
      decisionMakerName: "Nisha Kapoor",
      decisionMakerDesignation: "Procurement Head",
      result: "qualified",
      qualifiedBy: salesUser.id,
    },
    {
      organizationId: org.id,
      leadId: lead2.id,
      requirementClarity: "partially_clear",
      budgetAvailability: "estimated",
      purchaseTimeline: "31_90_days",
      decisionMaker: "partially_identified",
      companyScale: "moderate_fit",
      productFit: "partial_fit",
      conversionProbability: "medium",
      decisionMakerName: "Vikram Rao",
      decisionMakerDesignation: "IT Director",
      result: "partially_qualified",
      qualifiedBy: managerUser.id,
    },
  ]);

  await db.insert(leadAssignments).values([
    {
      organizationId: org.id,
      leadId: lead1.id,
      assignedTo: salesUser.id,
      assignedBy: managerUser.id,
      strategy: "manual",
    },
    {
      organizationId: org.id,
      leadId: lead2.id,
      assignedTo: managerUser.id,
      assignedBy: adminUser.id,
      strategy: "round_robin",
    },
  ]);

  // ---- Clients + contacts ----
  const clientRows = await db
    .insert(clients)
    .values([
      {
        organizationId: org.id,
        sourceLeadId: lead1.id,
        clientNumber: "CL-1024",
        companyName: "Acme Industries",
        industry: "Manufacturing",
        website: "https://acme.example",
        accountManagerId: salesUser.id,
        status: "active",
        vipFlag: true,
      },
      {
        organizationId: org.id,
        clientNumber: "CL-1025",
        companyName: "Vertex Retail",
        industry: "Retail",
        website: "https://vertex.example",
        accountManagerId: managerUser.id,
        status: "active",
      },
    ])
    .returning();
  const [client1, client2] = clientRows;

  const contactRows = await db
    .insert(contacts)
    .values([
      {
        organizationId: org.id,
        clientId: client1.id,
        firstName: "Nisha",
        lastName: "Kapoor",
        designation: "VP Procurement",
        email: "nisha.kapoor@acme.example",
        phone: "+91 90000 10001",
        isPrimary: true,
      },
      {
        organizationId: org.id,
        clientId: client1.id,
        firstName: "Rahul",
        lastName: "Mehta",
        designation: "CFO",
        email: "rahul.mehta@acme.example",
        isPrimary: false,
      },
      {
        organizationId: org.id,
        clientId: client2.id,
        firstName: "Priya",
        lastName: "Shah",
        designation: "CEO",
        email: "priya.shah@vertex.example",
        isPrimary: true,
      },
    ])
    .returning();
  const [contact1] = contactRows;

  // ---- Opportunities ----
  const oppRows = await db
    .insert(opportunities)
    .values([
      {
        organizationId: org.id,
        clientId: client1.id,
        ownerId: salesUser.id,
        stageId: stageProposal.id,
        name: "Acme CRM Rollout",
        opportunityNumber: "OPP-301",
        amount: 4280000,
        currency: "INR",
        probability: 60,
        productService: "Revora Enterprise",
        expectedCloseDate: new Date("2026-09-30"),
      },
      {
        organizationId: org.id,
        clientId: client2.id,
        ownerId: managerUser.id,
        stageId: stageQualified.id,
        name: "Vertex Sales Suite",
        opportunityNumber: "OPP-302",
        amount: 1250000,
        currency: "INR",
        probability: 30,
        productService: "Revora Professional",
        expectedCloseDate: new Date("2026-10-15"),
      },
    ])
    .returning();
  const [opp1, opp2] = oppRows;

  await db.insert(opportunityStageHistory).values([
    {
      organizationId: org.id,
      opportunityId: opp1.id,
      previousStageId: stageQualified.id,
      newStageId: stageProposal.id,
      changedBy: salesUser.id,
      reason: "Proposal sent",
    },
    {
      organizationId: org.id,
      opportunityId: opp2.id,
      previousStageId: stageNew.id,
      newStageId: stageQualified.id,
      changedBy: managerUser.id,
      reason: "Budget confirmed",
    },
  ]);

  // ---- Tasks + activities + meetings ----
  await db.insert(tasks).values([
    {
      organizationId: org.id,
      title: "Send proposal to Acme",
      assignedTo: salesUser.id,
      createdBy: managerUser.id,
      dueDate: new Date("2026-08-20"),
      priority: "high",
      status: "in_progress",
      opportunityId: opp1.id,
    },
    {
      organizationId: org.id,
      title: "Follow up with Vertex CEO",
      assignedTo: managerUser.id,
      createdBy: adminUser.id,
      dueDate: new Date("2026-08-18"),
      priority: "medium",
      status: "pending",
      clientId: client2.id,
    },
  ]);

  await db.insert(activities).values([
    {
      organizationId: org.id,
      type: "call",
      subject: "Introductory call with Nisha",
      leadId: lead1.id,
      performedBy: salesUser.id,
    },
    {
      organizationId: org.id,
      type: "email",
      subject: "Proposal discussion",
      opportunityId: opp1.id,
      performedBy: salesUser.id,
    },
  ]);

  const meetingRows = await db
    .insert(meetings)
    .values([
      {
        organizationId: org.id,
        title: "Acme demo & discovery",
        scheduledAt: new Date("2026-08-21T10:00:00Z"),
        durationMinutes: 60,
        organizerId: salesUser.id,
        status: "scheduled",
      },
    ])
    .returning();
  await db.insert(meetingParticipants).values([
    { meetingId: meetingRows[0].id, userId: salesUser.id, participantType: "organizer" },
    { meetingId: meetingRows[0].id, contactId: contact1.id, participantType: "external" },
  ]);

  // ---- Follow-ups (with action description) ----
  await db.insert(followups).values([
    {
      organizationId: org.id,
      clientId: client1.id,
      opportunityId: opp1.id,
      assignedTo: salesUser.id,
      channel: "phone",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      priority: "high",
      status: "pending",
      actionDescription: "Call Nisha to confirm proposal review timeline",
    },
    {
      organizationId: org.id,
      clientId: client2.id,
      assignedTo: managerUser.id,
      channel: "email",
      scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      priority: "high",
      status: "pending",
      actionDescription: "Send proposal reminder to Priya",
    },
  ]);

  // ---- User notification preferences ----
  await db.insert(userNotificationPreferences).values([
    { organizationId: org.id, userId: salesUser.id, emailEnabled: true, inAppEnabled: true },
    { organizationId: org.id, userId: managerUser.id, emailEnabled: true, inAppEnabled: true },
    { organizationId: org.id, userId: adminUser.id, emailEnabled: true, inAppEnabled: true },
  ]);

  // ---- Sample notifications (real records) ----
  await db.insert(notifications).values([
    {
      organizationId: org.id,
      userId: salesUser.id,
      type: "follow_up_overdue",
      title: "Follow-up overdue",
      message: "The follow-up 'Send proposal reminder to Priya' is overdue.",
      relatedEntityType: "client",
      relatedEntityId: client2.id,
    },
    {
      organizationId: org.id,
      userId: managerUser.id,
      type: "stage_changed",
      title: "Opportunity moved to Proposal",
      message: "Acme CRM Rollout advanced to the Proposal stage.",
      relatedEntityType: "opportunity",
      relatedEntityId: opp1.id,
    },
  ]);

  // ---- AI insights (illustrative, explainable) ----
  await db.insert(aiInsights).values([
    {
      organizationId: org.id,
      entityType: "lead",
      entityId: lead1.id,
      insightType: "lead_score",
      result: "High Probability",
      score: 94,
      confidence: 91,
      reasons: ["Budget matches", "Requirement is clear", "Decision maker identified"],
      positiveSignals: ["Purchase timeline is short", "Engaged with proposal"],
      riskSignals: ["No response for 2 days"],
      recommendation: "Contact the decision maker today.",
      modelVersion: "dev-placeholder",
    },
  ]);

  console.log("[seed] Development seed complete.", {
    organizationId: org.id,
    users: [adminUser, managerUser, salesUser].length,
    leads: leadRows.length,
    clients: clientRows.length,
    contacts: contactRows.length,
    opportunities: oppRows.length,
  });
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
