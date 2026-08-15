import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  roles,
  userRoles,
  rolePermissions,
  leads,
  leadStatusHistory,
  leadAssignments,
  auditLogs,
} from "./schema";
import { LeadService } from "@/server/services/leads";
import { buildCsv, buildExport } from "@/server/services/lead-export";
import { LEAD_SOURCES } from "@/lib/leads/schemas";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "leads-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-2`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, o.id));
    await db.delete(leadAssignments).where(eq(leadAssignments.organizationId, o.id));
    await db.delete(leads).where(eq(leads.organizationId, o.id));

    const userRows = await db.select().from(users).where(eq(users.organizationId, o.id));
    for (const u of userRows) {
      await db.delete(userRoles).where(eq(userRoles.userId, u.id));
      await db.delete(users).where(eq(users.id, u.id));
    }

    const roleRows = await db.select().from(roles).where(eq(roles.organizationId, o.id));
    for (const r of roleRows) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, r.id));
    }
    await db.delete(roles).where(eq(roles.organizationId, o.id));
    await db.delete(organizations).where(eq(organizations.id, o.id));
  }
}

async function main() {
  console.log("[leads-smoke] Starting Phase 7 lead management smoke test...");
  await cleanup();

  // ---- Setup tenant + user ----
  const [org] = await db.insert(organizations).values({ name: "Leads Smoke", slug: SLUG }).returning();
  const [user] = await db.insert(users).values({
    organizationId: org.id,
    email: "lead@revora.local",
    fullName: "Lead Tester",
  }).returning();

  const service = new LeadService(org.id);
  const actor = { userId: user.id };

  // ---- Create ----
  const created = await service.create(actor, {
    firstName: "Anita",
    lastName: "Desai",
    email: "anita@example.com",
    companyName: "Orbit Corp",
    source: "google_search",
    status: "new",
    budget: 50000,
  });
  assert(created.fullName === "Anita Desai", "create syncs full_name from first/last");
  assert(created.firstName === "Anita" && created.lastName === "Desai", "structured names persisted");
  assert(created.aiScore === null, "no fabricated AI score on create");
  assert(LEAD_SOURCES.includes(created.source as never), "Track A source accepted");

  // ---- List + search + filter ----
  const { rows, total } = await service.list({
    pagination: { page: 1, pageSize: 20, offset: 0 },
    sort: { column: "createdAt", order: "desc" },
    search: "Anita",
  });
  assert(total === 1 && rows[0].id === created.id, "list search finds lead");

  const filtered = await service.list({
    pagination: { page: 1, pageSize: 20, offset: 0 },
    sort: { column: "createdAt", order: "desc" },
    filters: { status: "qualified" },
  });
  assert(filtered.total === 0, "status filter excludes non-matching lead");

  // ---- Status change + history ----
  await service.changeStatus(actor, created.id, { status: "contacted", notes: "First touch" });
  const detail = await service.getById(created.id);
  assert(detail.status === "contacted", "status updated");
  assert(detail.statusHistory.length === 2, "status history has 2 entries");
  assert(detail.statusHistory[0].toStatus === "contacted", "latest history entry first");

  // ---- Assign ----
  await service.assign(actor, created.id, { ownerId: user.id, strategy: "manual" });
  const assigned = await service.getById(created.id);
  assert(assigned.ownerId === user.id, "owner assigned");

  // ---- Summary ----
  const summary = await service.summary();
  assert(summary.total === 1, "summary total");
  assert(summary.byStatus.contacted === 1, "summary status count");

  // ---- Export (CSV/XLSX/PDF) ----
  const exportRows = await service.exportRows({
    sort: { column: "createdAt", order: "desc" },
    limit: 100,
  });
  assert(exportRows.length === 1, "export rows fetched");

  const csv = buildCsv(exportRows);
  assert(csv.includes("Lead Number") && csv.includes("Anita"), "csv built");

  const xlsx = await buildExport("xlsx", exportRows);
  assert(xlsx.extension === "xlsx" && xlsx.body instanceof Buffer, "xlsx built");

  const pdf = await buildExport("pdf", exportRows);
  assert(pdf.extension === "pdf" && pdf.body instanceof Buffer, "pdf built");

  // ---- Archive + tenant isolation ----
  await service.archive(actor, created.id);
  const afterArchive = await service.getById(created.id).catch(() => null);
  assert(afterArchive === null, "archived lead no longer retrievable");

  const audit = await db.query.auditLogs.findMany({ where: eq(auditLogs.organizationId, org.id) });
  assert(audit.length >= 4, "audit entries recorded (create/status/assign/archive)");

  // Cross-tenant isolation: second org cannot see the lead.
  const [org2] = await db.insert(organizations).values({ name: "Other", slug: "leads-smoke-2" }).returning();
  const otherService = new LeadService(org2.id);
  const otherRows = await otherService.list({
    pagination: { page: 1, pageSize: 20, offset: 0 },
    sort: { column: "createdAt", order: "desc" },
  });
  assert(otherRows.total === 0, "tenant isolation enforced");

  await cleanup();
  console.log("[leads-smoke] All Phase 7 lead smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[leads-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
