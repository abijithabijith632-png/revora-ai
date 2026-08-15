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
  opportunityStageHistory,
  pipelineStages,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { OpportunityService } from "@/server/services/opportunities";
import { canTransition, stageProbability } from "@/lib/opportunities/pipeline";
import { ForbiddenError } from "@/lib/errors";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "opportunities-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(opportunityStageHistory).where(eq(opportunityStageHistory.organizationId, o.id));
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
  console.log("[opportunities-smoke] Starting Phase 12 opportunity + pipeline smoke test...");
  await cleanup();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Opportunities Smoke", slug: SLUG })
    .returning();
  const byName = await seedRoles(org.id);

  const [admin, manager] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@opp.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "mgr@opp.test", fullName: "Manager", status: "active" },
    ])
    .returning();
  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: manager.id, roleId: byName.get("Sales Executive")! },
  ]);

  assert(await userHasPermission(admin.id, org.id, "opportunities.create"), "Super Admin has opportunities.create");
  assert(!(await userHasPermission(manager.id, org.id, "opportunities.delete")), "Sales Executive lacks opportunities.delete");

  // Seed stages + client.
  await db
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
  // (stage IDs resolved by service via canonical keys)

  const [client] = await db
    .insert(clients)
    .values({
      organizationId: org.id,
      clientNumber: "CL-2001",
      companyName: "Opp Client",
    })
    .returning();

  const service = new OpportunityService(org.id);
  const actor = { userId: admin.id };

  // Create opportunity.
  const opp = await service.create(actor, {
    name: "Enterprise Website Redesign",
    clientId: client.id,
    ownerId: manager.id,
    amount: 1000000,
    stageKey: "new",
  });
  assert(opp.opportunityNumber.startsWith("OPP-"), "human-readable opportunity ID generated");
  assert(opp.probability === stageProbability("new"), "default stage probability applied");

  // List + search.
  const { total } = await service.list({
    pagination: { page: 1, pageSize: 20, offset: 0 },
    sort: { column: "createdAt", order: "desc" },
    search: "Website",
  });
  assert(total === 1, "opportunity search works");

  // Valid transition new → qualified.
  await service.changeStage(actor, opp.id, { stageKey: "qualified" });
  const qualified = await service.getById(opp.id);
  assert(qualified.stageKey === "qualified", "valid transition applied");
  assert(qualified.probability === stageProbability("qualified"), "probability recalculated on transition");

  // Invalid transition qualified → won rejected.
  let invalidRejected = false;
  try {
    await service.changeStage(actor, opp.id, { stageKey: "won" });
  } catch (e) {
    invalidRejected = e instanceof ForbiddenError;
  }
  assert(invalidRejected, "invalid transition rejected");

  // Lost requires reason.
  let reasonRequired = false;
  try {
    await service.changeStage(actor, opp.id, { stageKey: "lost" });
  } catch (e) {
    reasonRequired = (e as Error).message.includes("loss reason");
  }
  assert(reasonRequired, "lost requires reason");

  // Stage history recorded.
  const history = await service.getById(opp.id);
  assert(history.history.length === 2, "stage history recorded (create + transition)");

  // Pipeline summary computes weighted value.
  const summary = await service.pipelineSummary();
  assert(summary.totals.count >= 1, "pipeline summary totals populated");
  assert(Number(summary.totals.weightedValue) > 0, "weighted pipeline value computed");

  // Tenant isolation.
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherService = new OpportunityService(orgOther.id);
  let isolated = false;
  try {
    await otherService.getById(opp.id);
  } catch (e) {
    isolated = (e as Error).message.includes("not found");
  }
  assert(isolated, "cross-tenant opportunity access blocked");

  // Pure transition validation.
  assert(canTransition("new", "qualified"), "new → qualified allowed");
  assert(canTransition("proposal", "negotiation"), "proposal → negotiation allowed");
  assert(!canTransition("won", "new"), "won → new rejected");
  assert(canTransition("proposal", "lost"), "proposal → lost allowed");

  await cleanup();
  console.log("[opportunities-smoke] All Phase 12 opportunity + pipeline smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[opportunities-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
