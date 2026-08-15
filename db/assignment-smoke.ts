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
  leadAssignments,
  leadStatusHistory,
  leadQualifications,
  userSkills,
  routingRules,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { AssignmentService } from "@/server/services/assignment";
import { DeduplicationService } from "@/server/services/deduplication";
import { LeadRepository } from "@/server/repositories/leads";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "assignment-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(leadAssignments).where(eq(leadAssignments.organizationId, o.id));
    await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, o.id));
    await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, o.id));
    await db.delete(routingRules).where(eq(routingRules.organizationId, o.id));
    await db.delete(userSkills).where(eq(userSkills.organizationId, o.id));
    await db.delete(leads).where(eq(leads.organizationId, o.id));
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
      { organizationId: orgId, name: "Sales Manager", isSystem: true },
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

  const byName = new Map(roleRows.map((r) => [r.name, r.id]));
  return byName;
}

async function main() {
  console.log("[assignment-smoke] Starting Phase 10 assignment + dedup smoke test...");
  await cleanup();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Assignment Smoke", slug: SLUG })
    .returning();

  const byName = await seedRoles(org.id);

  const [admin, exec1, exec2, suspended] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "a@assign.test", fullName: "Admin Assign", status: "active" },
      { organizationId: org.id, email: "e1@assign.test", fullName: "Exec One", status: "active" },
      { organizationId: org.id, email: "e2@assign.test", fullName: "Exec Two", status: "active" },
      { organizationId: org.id, email: "e3@assign.test", fullName: "Exec Three", status: "suspended" },
    ])
    .returning();

  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: exec1.id, roleId: byName.get("Sales Executive")! },
    { userId: exec2.id, roleId: byName.get("Sales Executive")! },
    { userId: suspended.id, roleId: byName.get("Sales Executive")! },
  ]);

  // ---- RBAC: Super Admin has leads.assign, Sales Executive does not ----
  assert(
    await userHasPermission(admin.id, org.id, "leads.assign"),
    "Super Admin has leads.assign",
  );
  assert(
    !(await userHasPermission(exec1.id, org.id, "leads.assign")),
    "Sales Executive lacks leads.assign (least privilege)",
  );

  const leadRepo = new LeadRepository(org.id);
  const assignmentService = new AssignmentService(org.id);
  const dedupService = new DeduplicationService(org.id);
  const actor = { userId: admin.id };

  // Create leads: one unassigned, one assigned to exec1, and duplicates.
  const [leadA, leadB, leadDupEmail, leadDupPhone] = await db
    .insert(leads)
    .values([
      {
        organizationId: org.id,
        leadNumber: "LD-A1",
        firstName: "Alpha",
        fullName: "Alpha Lead",
        status: "new",
        geography: "Mumbai",
        industry: "Manufacturing",
        interestedProduct: "CRM",
      },
      {
        organizationId: org.id,
        leadNumber: "LD-A2",
        firstName: "Beta",
        fullName: "Beta Lead",
        status: "new",
        ownerId: exec1.id,
        geography: "Bengaluru",
        industry: "Technology",
        interestedProduct: "Analytics",
      },
      {
        organizationId: org.id,
        leadNumber: "LD-D1",
        firstName: "Dup",
        fullName: "Dup Email",
        email: "dup@revora.local",
        status: "new",
      },
      {
        organizationId: org.id,
        leadNumber: "LD-D2",
        firstName: "Dup2",
        fullName: "Dup Phone",
        phone: "+91 90000 99999",
        status: "new",
      },
    ])
    .returning();

  // ---- Eligibility: suspended user excluded; active executives returned ----
  const eligible = await assignmentService.listEligible();
  const eligibleIds = eligible.map((u) => u.id);
  assert(eligibleIds.includes(exec1.id) && eligibleIds.includes(exec2.id), "active executives eligible");
  assert(!eligibleIds.includes(suspended.id), "suspended executive excluded");

  // ---- Manual assignment validates eligibility ----
  let rejected = false;
  try {
    await assignmentService.manualAssign(actor, leadA.id, suspended.id);
  } catch (e) {
    rejected = (e as Error).message.includes("not eligible");
  }
  assert(rejected, "manual assignment rejects ineligible user");

  // ---- Manual assignment succeeds + previousOwner recorded ----
  await assignmentService.manualAssign(actor, leadB.id, exec2.id, "Reassign");
  const reassigned = await leadRepo.findById(leadB.id);
  assert(reassigned?.ownerId === exec2.id, "manual reassignment updates owner");

  const hist = await assignmentService.history(leadB.id);
  assert(
    hist.some((h) => h.previousOwnerId === exec1.id && h.assignedToName === "Exec Two"),
    "assignment history records previous owner",
  );

  // ---- Round-robin picks least workload (exec1 has 0, exec2 has 1) ----
  await assignmentService.autoAssign(actor, leadA.id, { strategy: "round_robin" });
  const rr = await leadRepo.findById(leadA.id);
  assert(rr?.ownerId === exec1.id, "round-robin assigns least-workload executive");

  // ---- Territory routing via routingRules ----
  await db.insert(routingRules).values({
    organizationId: org.id,
    strategy: "territory",
    priority: 0,
    active: true,
    conditionField: "geography",
    conditionValue: "Bengaluru",
    targetUserId: exec1.id,
  });

  const [leadTerr] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-T1",
      firstName: "Terr",
      fullName: "Territory Lead",
      status: "new",
      geography: "Bengaluru",
    })
    .returning();
  await assignmentService.autoAssign(actor, leadTerr.id, { strategy: "territory" });
  const terr = await leadRepo.findById(leadTerr.id);
  assert(terr?.ownerId === exec1.id, "territory routing matches geography rule");

  // ---- Skill routing via routingRules + userSkills ----
  await db.insert(userSkills).values({
    organizationId: org.id,
    userId: exec2.id,
    skill: "CRM",
    skillType: "product",
    proficiency: "expert",
  });
  await db.insert(routingRules).values({
    organizationId: org.id,
    strategy: "skill",
    priority: 0,
    active: true,
    conditionField: "product",
    conditionValue: "CRM",
    targetUserId: exec2.id,
  });

  const [leadSkill] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-S1",
      firstName: "Skill",
      fullName: "Skill Lead",
      status: "new",
      interestedProduct: "CRM",
    })
    .returning();
  await assignmentService.autoAssign(actor, leadSkill.id, { strategy: "skill" });
  const skill = await leadRepo.findById(leadSkill.id);
  assert(skill?.ownerId === exec2.id, "skill routing matches product skill");

  // ---- Dedup detection: email + phone matches ----
  const [leadDupEmail2] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-D1B",
      firstName: "Dup",
      fullName: "Dup Email Two",
      email: "DUP@revora.local", // case/whitespace normalized
      status: "new",
    })
    .returning();

  const emailDups = await dedupService.findDuplicates(leadDupEmail2.id);
  assert(
    emailDups.some((d) => d.id === leadDupEmail.id && d.matchReason === "email"),
    "duplicate detection matches normalized email",
  );

  const [leadDupPhone2] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-D2B",
      firstName: "Dup2",
      fullName: "Dup Phone Two",
      phone: "+91-90000-99999",
      status: "new",
    })
    .returning();
  const phoneDups = await dedupService.findDuplicates(leadDupPhone2.id);
  assert(
    phoneDups.some((d) => d.id === leadDupPhone.id && d.matchReason === "phone"),
    "duplicate detection matches normalized phone",
  );

  // ---- Safe merge ----
  const mergeResult = await dedupService.merge(actor, leadDupEmail2.id, leadDupEmail.id);
  assert(mergeResult.merged === true, "merge completes");
  const mergedSource = await db
    .select({ isDeleted: leads.isDeleted, mergedIntoId: leads.mergedIntoId })
    .from(leads)
    .where(eq(leads.id, leadDupEmail2.id))
    .limit(1);
  assert(mergedSource[0]?.isDeleted === true, "merged duplicate soft-deleted");
  assert(mergedSource[0]?.mergedIntoId === leadDupEmail.id, "mergedIntoId set to target");

  // ---- Tenant isolation ----
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherService = new DeduplicationService(orgOther.id);
  let isolated = false;
  try {
    await otherService.findDuplicates(leadDupEmail.id);
  } catch (e) {
    isolated = (e as Error).message.includes("not found");
  }
  assert(isolated, "cross-tenant duplicate access blocked");

  // ---- Telemetry returns KPIs + workload ----
  const telemetry = await assignmentService.telemetry();
  assert(telemetry.kpis.total >= 6, "telemetry totals populated");
  assert(Array.isArray(telemetry.workload), "telemetry workload list returned");

  await cleanup();
  console.log("[assignment-smoke] All Phase 10 assignment + dedup smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[assignment-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
