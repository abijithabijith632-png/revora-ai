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
  plans,
  subscriptions,
  invoices,
  payments,
  invitations,
  leadStatusConfigs,
  leadSourceConfigs,
  pipelineStages,
  leads,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LeadConfigService } from "@/server/services/lead-config";
import { PipelineConfigService } from "@/server/services/pipeline-config";
import { BillingService } from "@/server/services/billing";
import { OrganizationSettingsService } from "@/server/services/organization-settings";
import { UserAdminService } from "@/server/services/user-admin";
import { PlatformService } from "@/server/services/platform";
import { getPlan, checkEntitlement } from "@/lib/billing";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "phase16-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(payments).where(eq(payments.organizationId, o.id));
    await db.delete(invoices).where(eq(invoices.organizationId, o.id));
    await db.delete(invitations).where(eq(invitations.organizationId, o.id));
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, o.id));
    await db.delete(leadStatusConfigs).where(eq(leadStatusConfigs.organizationId, o.id));
    await db.delete(leadSourceConfigs).where(eq(leadSourceConfigs.organizationId, o.id));
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
  console.log("[phase16-smoke] Starting Phase 16 admin + SaaS smoke test...");
  await cleanup();

  // Seed global plans (idempotent).
  await db
    .insert(plans)
    .values([
      { name: "FREE", description: "Free", priceMonthly: null, limits: { userSeats: 2, leadStorage: 100, aiUsage: 20 }, isActive: true },
      { name: "STARTER", description: "Starter", priceMonthly: 29, limits: { userSeats: 10, leadStorage: 5000, aiUsage: 500 }, isActive: true },
      { name: "PROFESSIONAL", description: "Professional", priceMonthly: 99, limits: { userSeats: 50, leadStorage: 50000, aiUsage: 5000 }, isActive: true },
      { name: "ENTERPRISE", description: "Enterprise", priceMonthly: 499, limits: { userSeats: null, leadStorage: null, aiUsage: null }, isActive: true },
    ])
    .onConflictDoNothing();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Phase 16 Smoke", slug: SLUG })
    .returning();
  const byName = await seedRoles(org.id);

  const [admin, exec] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@phase16.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "exec@phase16.test", fullName: "Exec", status: "active" },
    ])
    .returning();
  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: exec.id, roleId: byName.get("Sales Executive")! },
  ]);

  // ---- RBAC / least privilege ----
  assert(await userHasPermission(admin.id, org.id, "billing.edit"), "Super Admin has billing.edit");
  assert(await userHasPermission(admin.id, org.id, "lead_statuses.create"), "Super Admin has lead_statuses.create");
  assert(!(await userHasPermission(exec.id, org.id, "billing.view")), "Sales Executive lacks billing.view (least privilege)");

  // ---- Feature gating ----
  assert(checkEntitlement("PROFESSIONAL", "custom_configuration").allowed, "PROFESSIONAL allows custom config");
  assert(!checkEntitlement("STARTER", "custom_configuration").allowed, "STARTER blocks custom config");
  assert(getPlan("FREE").key === "FREE", "plan resolution");

  // ---- Org settings ----
  const orgService = new OrganizationSettingsService(org.id);
  const profile = await orgService.updateProfile({ userId: admin.id }, {
    industry: "SaaS",
    website: "https://example.com",
    currency: "USD",
  });
  assert(profile.industry === "SaaS", "org profile updated");
  assert(profile.currency === "USD", "org currency updated");

  // ---- Lead status config ----
  const leadCfg = new LeadConfigService(org.id);
  const status = await leadCfg.upsertStatus({ userId: admin.id }, {
    key: "Hot Lead",
    label: "Hot Lead",
    isActive: true,
  });
  assert(status.key === "hot_lead", "custom lead status normalized");
  const statuses = await leadCfg.listStatuses();
  assert(statuses.length === 1, "custom status listed");

  // System key protection
  let rejected = false;
  try {
    await leadCfg.upsertStatus({ userId: admin.id }, { key: "new", label: "X" });
  } catch {
    rejected = true;
  }
  assert(rejected, "system status key cannot be overwritten");

  const source = await leadCfg.upsertSource({ userId: admin.id }, { key: "Webinar", label: "Webinar" });
  assert(source.key === "webinar", "custom lead source normalized");

  // ---- Pipeline config ----
  const pipelineCfg = new PipelineConfigService(org.id);
  const stage = await pipelineCfg.create({ userId: admin.id }, {
    name: "Review",
    key: "review",
    orderIndex: 1,
    probability: 45,
  });
  assert(stage.probability === 45, "pipeline stage created with probability");

  let probRejected = false;
  try {
    await pipelineCfg.create({ userId: admin.id }, { name: "Bad", key: "bad", orderIndex: 2, probability: 150 });
  } catch {
    probRejected = true;
  }
  assert(probRejected, "invalid probability (150) rejected");

  // ---- Billing ----
  const billing = new BillingService(org.id);
  const overview = await billing.overview();
  assert(overview.plans.length >= 4, "plan catalog listed");

  // Payment not configured → paid plan change blocked
  let paidBlocked = false;
  try {
    await billing.changePlan({ userId: admin.id }, "PROFESSIONAL");
  } catch {
    paidBlocked = true;
  }
  assert(paidBlocked, "paid plan change gated without payment provider");

  // No subscription yet → default FREE; changing to FREE is a no-op conflict.
  let alreadyFree = false;
  try {
    await billing.changePlan({ userId: admin.id }, "FREE");
  } catch {
    alreadyFree = true;
  }
  assert(alreadyFree, "FREE change to current default plan rejected (no-op)");

  const invoice = await billing.generateInvoice({ userId: admin.id });
  assert(invoice.invoiceNumber.startsWith("INV-"), "invoice generated");
  assert(invoice.amount === 0, "FREE plan invoice amount 0");

  // ---- Invitations ----
  const userAdmin = new UserAdminService(org.id);
  const invite = await userAdmin.invite(
    { userId: admin.id, roleNames: ["Super Admin"] },
    { email: "new@phase16.test", roleId: byName.get("Sales Executive")! },
  );
  assert(Boolean(invite.token), "invitation token issued (raw once)");

  const accepted = await userAdmin.acceptInvitation(invite.token, {
    fullName: "New User",
    password: "Str0ng@Pass1",
  });
  assert(Boolean(accepted.userId), "invitation accepted creates user");

  // Duplicate invite rejected
  let dupRejected = false;
  try {
    await userAdmin.invite({ userId: admin.id, roleNames: ["Super Admin"] }, { email: "new@phase16.test", roleId: null });
  } catch {
    dupRejected = true;
  }
  assert(dupRejected, "duplicate invitation rejected");

  // ---- Platform telemetry + health ----
  const platform = new PlatformService();
  const telemetry = await platform.telemetry();
  assert(telemetry.totalOrganizations >= 1, "platform telemetry total orgs");
  assert(Array.isArray(telemetry.unavailableMetrics), "unavailable metrics reported honestly");
  const health = await platform.health();
  assert(health.checks.database === "up" || health.checks.database === "down", "health check returns real db status");

  // ---- Tenant isolation ----
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherCfg = new LeadConfigService(orgOther.id);
  const otherStatuses = await otherCfg.listStatuses();
  assert(otherStatuses.length === 0, "cross-tenant lead config isolated");

  await cleanup();
  console.log("[phase16-smoke] All Phase 16 admin + SaaS smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[phase16-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
