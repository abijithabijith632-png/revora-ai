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
  clients,
  opportunities,
  pipelineStages,
  tasks,
  activities,
  aiInsights,
  aiPredictionHistory,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { SearchService } from "@/server/services/search";
import { AnalyticsService } from "@/server/services/analytics";
import { ForecastingService } from "@/server/services/forecasting";
import { ReportingService } from "@/server/services/reporting";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "phase15-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(aiPredictionHistory).where(eq(aiPredictionHistory.organizationId, o.id));
    await db.delete(aiInsights).where(eq(aiInsights.organizationId, o.id));
    await db.delete(activities).where(eq(activities.organizationId, o.id));
    await db.delete(tasks).where(eq(tasks.organizationId, o.id));
    await db.delete(opportunities).where(eq(opportunities.organizationId, o.id));
    await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, o.id));
    await db.delete(clients).where(eq(clients.organizationId, o.id));
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
  console.log("[phase15-smoke] Starting Phase 15 analytics + search smoke test...");
  await cleanup();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Phase 15 Smoke", slug: SLUG })
    .returning();
  const byName = await seedRoles(org.id);

  const [admin, exec] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@phase15.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "exec@phase15.test", fullName: "Exec", status: "active" },
    ])
    .returning();

  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: exec.id, roleId: byName.get("Sales Executive")! },
  ]);

  // RBAC
  assert(await userHasPermission(admin.id, org.id, "analytics.view"), "Super Admin has analytics.view");
  assert(!(await userHasPermission(exec.id, org.id, "reports.export")), "Sales Executive lacks reports.export (least privilege)");

  // Seed lead + client + opportunity + stage + activity
  await db.insert(leads).values({
    organizationId: org.id,
    leadNumber: "LD-P15",
    firstName: "Alice",
    lastName: "Search",
    fullName: "Alice Search",
    email: "alice@example.com",
    companyName: "Acme Analytics",
    source: "website",
    status: "qualified",
    ownerId: admin.id,
    qualificationStatus: "qualified",
  });

  const [client] = await db
    .insert(clients)
    .values({ organizationId: org.id, companyName: "Acme Analytics", clientNumber: "CL-P15", status: "active" })
    .returning();

  const [, stageWon] = await db
    .insert(pipelineStages)
    .values([
      { organizationId: org.id, name: "New", key: "new", orderIndex: 1, probability: 10, isTerminal: false },
      { organizationId: org.id, name: "Won", key: "won", orderIndex: 2, probability: 100, isTerminal: true },
    ])
    .returning();

  const [opp] = await db
    .insert(opportunities)
    .values({
      organizationId: org.id,
      clientId: client.id,
      ownerId: admin.id,
      stageId: stageWon.id,
      name: "Acme Deal",
      opportunityNumber: "OPP-P15",
      amount: 500000,
      probability: 100,
    })
    .returning();

  await db.insert(activities).values([
    { organizationId: org.id, type: "call", subject: "Call with Alice", clientId: client.id, performedBy: admin.id },
  ]);

  // ---- Global search ----
  const searchService = new SearchService(org.id);
  const results = await searchService.search("Acme");
  assert(results.some((r) => r.entityType === "lead"), "search finds lead by company");
  assert(results.some((r) => r.entityType === "client"), "search finds client by name");
  assert(results.some((r) => r.entityType === "opportunity"), "search finds opportunity by name");

  // ---- Analytics dashboard ----
  const analytics = new AnalyticsService(org.id);
  const dash = await analytics.dashboard();
  assert(dash.totalLeads === 1, "dashboard total leads");
  assert(dash.qualifiedLeads === 1, "dashboard qualified leads");
  assert(dash.wonDeals === 1, "dashboard won deals");
  assert(dash.totalRevenue === 500000, "dashboard won revenue");

  const funnel = await analytics.funnel();
  assert(funnel.stages.find((s) => s.stage === "won")?.count === 1, "funnel won count");

  const perf = await analytics.performance(admin.id);
  assert(perf.won === 1 && perf.revenue === 500000, "salesperson performance");

  // ---- Forecast ----
  const forecasting = new ForecastingService(org.id);
  const forecast = await forecasting.revenueForecast();
  assert(forecast.monthly.length === 1 && forecast.monthly[0].expectedRevenue >= 500000, "revenue forecast computed");
  assert(typeof forecast.explanation === "string", "forecast explained");

  const prediction = await forecasting.dealPrediction(opp.id);
  assert(prediction.winProbability === 100, "deal prediction win probability");
  assert(prediction.explanation.length > 0, "deal prediction explained");

  const risk = await forecasting.churnRisk();
  assert(Array.isArray(risk.risks), "churn risk array returned");

  // ---- Reports ----
  const reporting = new ReportingService(org.id);
  const csv = await reporting.buildReport("sales", "csv");
  assert(typeof csv.body === "string" && (csv.body as string).includes("Metric"), "CSV report built");
  const xlsx = await reporting.buildReport("sales", "xlsx");
  assert(Buffer.isBuffer(xlsx.body), "XLSX report built");
  const pdf = await reporting.buildReport("sales", "pdf");
  assert(Buffer.isBuffer(pdf.body), "PDF report built");

  // Tenant isolation: other org cannot find the lead
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherSearch = new SearchService(orgOther.id);
  const otherResults = await otherSearch.search("Acme");
  assert(otherResults.length === 0, "cross-tenant search returns no results");

  await cleanup();
  console.log("[phase15-smoke] All Phase 15 analytics + search smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[phase15-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
