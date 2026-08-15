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
  contacts,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ClientService } from "@/server/services/clients";
import { ContactService } from "@/server/services/contacts";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "clients-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(contacts).where(eq(contacts.organizationId, o.id));
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
  console.log("[clients-smoke] Starting Phase 11 client + contact smoke test...");
  await cleanup();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Clients Smoke", slug: SLUG })
    .returning();
  const byName = await seedRoles(org.id);

  const [admin, manager] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@clients.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "mgr@clients.test", fullName: "Manager", status: "active" },
    ])
    .returning();

  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: manager.id, roleId: byName.get("Sales Executive")! },
  ]);

  assert(
    await userHasPermission(admin.id, org.id, "clients.create"),
    "Super Admin has clients.create",
  );
  assert(
    !(await userHasPermission(manager.id, org.id, "clients.delete")),
    "Sales Executive lacks clients.delete (least privilege)",
  );

  const clientService = new ClientService(org.id);
  const contactService = new ContactService(org.id);
  const actor = { userId: admin.id };

  // Create client
  const client = await clientService.create(actor, {
    companyName: "Acme Corp",
    industry: "Technology",
    website: "https://acme.example",
    accountManagerId: manager.id,
    status: "active",
    vipFlag: false,
  });
  assert(client.clientNumber.startsWith("CL-"), "human-readable client ID generated");

  // Create contact
  const contact = await contactService.create(actor, {
    clientId: client.id,
    firstName: "Jane",
    lastName: "Doe",
    designation: "CEO",
    email: "jane@acme.example",
    isPrimary: true,
  });
  assert(contact.isPrimary, "primary contact created");

  // Second contact, set primary → first becomes non-primary
  await contactService.create(actor, {
    clientId: client.id,
    firstName: "John",
    lastName: "Smith",
    designation: "CTO",
    email: "john@acme.example",
    isPrimary: true,
  });
  const primaries = await db
    .select({ id: contacts.id, isPrimary: contacts.isPrimary })
    .from(contacts)
    .where(eq(contacts.clientId, client.id));
  const primaryCount = primaries.filter((c) => c.isPrimary).length;
  assert(primaryCount === 1, "exactly one primary contact per client");

  // List + search
  const { rows, total } = await clientService.list({
    pagination: { page: 1, pageSize: 20, offset: 0 },
    sort: { column: "createdAt", order: "desc" },
    search: "Acme",
  });
  assert(total === 1 && rows[0].id === client.id, "client search works");

  // Tenant isolation
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherService = new ClientService(orgOther.id);
  let isolated = false;
  try {
    await otherService.getById(client.id);
  } catch (e) {
    isolated = (e as Error).message.includes("not found");
  }
  assert(isolated, "cross-tenant client access blocked");

  await cleanup();
  console.log("[clients-smoke] All Phase 11 client + contact smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[clients-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
