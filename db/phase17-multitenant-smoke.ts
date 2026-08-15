import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  roles,
  userRoles,
  permissions,
  rolePermissions,
  leads,
  clients,
  contacts,
  opportunities,
  pipelineStages,
  documents,
  notifications,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { SearchService } from "@/server/services/search";
import { AnalyticsService } from "@/server/services/analytics";
import { LeadConfigService } from "@/server/services/lead-config";
import { BillingService } from "@/server/services/billing";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG_A = "phase17-mt-a";
const SLUG_B = "phase17-mt-b";

async function cleanupSlug(slug: string) {
  const orgs = await db.select().from(organizations).where(eq(organizations.slug, slug));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(notifications).where(eq(notifications.organizationId, o.id));
    await db.delete(documents).where(eq(documents.organizationId, o.id));
    await db.delete(opportunities).where(eq(opportunities.organizationId, o.id));
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

async function seedOrg(slug: string, company: string) {
  await db
    .insert(permissions)
    .values(ALL_PERMISSIONS.map((p) => ({ resource: p.split(".")[0], action: p.split(".")[1] })))
    .onConflictDoNothing();
  const allPerms = await db.select().from(permissions);
  const permKey = new Map(allPerms.map((p) => [`${p.resource}.${p.action}`, p.id]));

  const [org] = await db.insert(organizations).values({ name: company, slug }).returning();
  const [adminRole] = await db
    .insert(roles)
    .values({ organizationId: org.id, name: "Super Admin", isSystem: true })
    .returning();
  for (const p of ROLE_PERMISSION_MATRIX["Super Admin"]) {
    const pid = permKey.get(p);
    if (pid) await db.insert(rolePermissions).values({ roleId: adminRole.id, permissionId: pid });
  }
  const [user] = await db
    .insert(users)
    .values({ organizationId: org.id, email: `admin@${slug}.test`, fullName: `Admin ${company}`, status: "active" })
    .returning();
  await db.insert(userRoles).values({ userId: user.id, roleId: adminRole.id });

  // One tenant-scoped lead + client.
  const [lead] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: `LD-${slug.toUpperCase()}`,
      firstName: company,
      fullName: company,
      email: `lead@${slug}.test`,
      companyName: company,
      source: "website",
      status: "new",
      ownerId: user.id,
      qualificationStatus: "pending",
    })
    .returning();
  const [client] = await db
    .insert(clients)
    .values({ organizationId: org.id, clientNumber: `CL-${slug.toUpperCase()}`, companyName: company, status: "active" })
    .returning();

  return { orgId: org.id, userId: user.id, leadId: lead.id, clientId: client.id };
}

async function main() {
  console.log("[phase17-multitenant] Starting multi-tenant isolation smoke test...");
  await cleanupSlug(SLUG_A);
  await cleanupSlug(SLUG_B);

  const A = await seedOrg(SLUG_A, "Alpha Corp");
  const B = await seedOrg(SLUG_B, "Beta Corp");

  // ---- Search isolation ----
  const searchA = new SearchService(A.orgId);
  const searchB = new SearchService(B.orgId);
  const resultsA = await searchA.search("Alpha");
  const resultsB = await searchB.search("Alpha");
  assert(resultsA.some((r) => r.entityType === "lead"), "org A finds its own lead");
  assert(resultsB.length === 0, "org B cannot find org A lead (search isolation)");

  // ---- Analytics isolation ----
  const analyticsB = new AnalyticsService(B.orgId);
  const dashB = await analyticsB.dashboard();
  assert(dashB.totalLeads === 1, "org B analytics sees only its own leads (1)");

  // ---- Lead config isolation ----
  const cfgA = new LeadConfigService(A.orgId);
  const cfgB = new LeadConfigService(B.orgId);
  await cfgA.upsertStatus({ userId: A.userId }, { key: "AOnly", label: "A Only" });
  const statusesB = await cfgB.listStatuses();
  assert(statusesB.length === 0, "org B does not see org A custom lead status");

  // ---- Billing isolation ----
  const billingA = new BillingService(A.orgId);
  const billingB = new BillingService(B.orgId);
  const overviewA = await billingA.overview();
  const overviewB = await billingB.overview();
  assert(overviewA.usage.users === 1 && overviewB.usage.users === 1, "billing usage is tenant-scoped");

  // ---- Cross-tenant permission denial ----
  const canAAdminBilling = await userHasPermission(A.userId, B.orgId, "billing.view");
  assert(!canAAdminBilling, "org A user has no permission in org B context");

  await cleanupSlug(SLUG_A);
  await cleanupSlug(SLUG_B);
  console.log("[phase17-multitenant] Multi-tenant isolation smoke test passed.");
}

main()
  .catch((err) => {
    console.error("[phase17-multitenant] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
