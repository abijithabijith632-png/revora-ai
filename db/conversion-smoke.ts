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
  leadStatusHistory,
  leadQualifications,
  leadAssignments,
  clients,
  contacts,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { ConversionService } from "@/server/services/conversion";
import { ConflictError } from "@/lib/errors";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "conversion-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, SLUG));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(leadAssignments).where(eq(leadAssignments.organizationId, o.id));
    await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, o.id));
    await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, o.id));
    await db.delete(contacts).where(eq(contacts.organizationId, o.id));
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

async function seedPermissions() {
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
  return new Map(allPerms.map((p) => [`${p.resource}.${p.action}`, p.id]));
}

async function main() {
  console.log("[conversion-smoke] Starting Phase 11 conversion smoke test...");
  await cleanup();
  const permKey = await seedPermissions();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Conversion Smoke", slug: SLUG })
    .returning();

  const [role] = await db
    .insert(roles)
    .values({ organizationId: org.id, name: "Super Admin", isSystem: true })
    .returning();
  for (const p of ROLE_PERMISSION_MATRIX["Super Admin"]) {
    const pid = permKey.get(p);
    if (pid) await db.insert(rolePermissions).values({ roleId: role.id, permissionId: pid });
  }

  const [admin, manager] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@conv.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "mgr@conv.test", fullName: "Manager", status: "active" },
    ])
    .returning();
  await db.insert(userRoles).values([{ userId: admin.id, roleId: role.id }]);

  const actor = { userId: admin.id };
  const conversion = new ConversionService(org.id);

  // Unqualified lead → conversion rejected
  const [unqualified] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-C-UNQ",
      firstName: "Un",
      fullName: "Un Qualified",
      status: "new",
      qualificationStatus: "pending",
    })
    .returning();

  let rejected = false;
  try {
    await conversion.convert(actor, unqualified.id);
  } catch (e) {
    rejected = e instanceof ConflictError;
  }
  assert(rejected, "unqualified lead conversion rejected");

  // Qualified lead with history → convert
  const [qualified] = await db
    .insert(leads)
    .values({
      organizationId: org.id,
      leadNumber: "LD-C-Q1",
      firstName: "Qual",
      lastName: "Lead",
      fullName: "Qual Lead",
      email: "qual@conv.test",
      phone: "+91 90000 11111",
      companyName: "Qual Corp",
      industry: "Tech",
      website: "https://qual.example",
      ownerId: manager.id,
      status: "qualified",
      qualificationStatus: "qualified",
      notes: "Important historical note",
    })
    .returning();

  await db.insert(leadStatusHistory).values([
    {
      organizationId: org.id,
      leadId: qualified.id,
      fromStatus: "new",
      toStatus: "contacted",
      changedBy: admin.id,
      notes: "First contact",
    },
    {
      organizationId: org.id,
      leadId: qualified.id,
      fromStatus: "contacted",
      toStatus: "qualified",
      changedBy: admin.id,
      notes: "Qualified",
    },
  ]);

  const result = await conversion.convert(actor, qualified.id);
  assert(result.converted, "qualified lead converted");
  assert(result.clientNumber.startsWith("CL-"), "converted client ID generated");
  assert(result.contactId != null, "primary contact created from lead");

  const [convertedLead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.id, qualified.id));
  assert(convertedLead.status === "converted", "lead marked converted");

  const history = await db
    .select()
    .from(leadStatusHistory)
    .where(eq(leadStatusHistory.leadId, qualified.id));
  assert(history.length === 3, "lead history preserved (2 original + 1 conversion)");

  // Idempotency: second conversion returns same client
  const second = await conversion.convert(actor, qualified.id);
  assert(second.clientId === result.clientId, "double conversion is idempotent");

  // Client traceable to source lead
  const [clientRow] = await db
    .select({ sourceLeadId: clients.sourceLeadId })
    .from(clients)
    .where(eq(clients.id, result.clientId));
  assert(clientRow.sourceLeadId === qualified.id, "client traceable to source lead");

  await cleanup();
  console.log("[conversion-smoke] All Phase 11 conversion smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[conversion-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
