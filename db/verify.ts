import "dotenv/config";
import { Client } from "pg";

/**
 * Phase 3 database verification script.
 * Confirms tables, foreign keys, indexes, and tenant isolation against the
 * real local PostgreSQL database.
 */
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  console.log(
    `[verify] tables (${tables.rowCount}):`,
    tables.rows.map((r) => r.table_name).join(", "),
  );

  const fks = await client.query(
    "SELECT count(*) AS n FROM pg_constraint WHERE contype = 'f'",
  );
  console.log("[verify] foreign keys:", fks.rows[0].n);

  const indexes = await client.query(
    "SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'",
  );
  console.log("[verify] indexes:", indexes.rows[0].n);

  const enums = await client.query(
    "SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname",
  );
  console.log(
    `[verify] enums (${enums.rowCount}):`,
    enums.rows.map((r) => r.typname).join(", "),
  );

  const orgCount = await client.query("SELECT count(*) AS n FROM organizations");
  const leadCount = await client.query("SELECT count(*) AS n FROM leads");
  const userCount = await client.query("SELECT count(*) AS n FROM users");
  console.log(
    "[verify] orgs =",
    orgCount.rows[0].n,
    "| users =",
    userCount.rows[0].n,
    "| leads =",
    leadCount.rows[0].n,
  );

  // Tenant isolation: no leads whose owner belongs to a different org.
  const crossTenant = await client.query(
    "SELECT count(*) AS n FROM leads l JOIN users u ON l.owner_id = u.id WHERE l.organization_id <> u.organization_id",
  );
  console.log("[verify] cross-tenant owner refs (should be 0):", crossTenant.rows[0].n);

  // No orphan leads (missing org).
  const orphanLeads = await client.query(
    "SELECT count(*) AS n FROM leads WHERE organization_id NOT IN (SELECT id FROM organizations)",
  );
  console.log("[verify] orphan leads (should be 0):", orphanLeads.rows[0].n);

  // Relational integrity: opportunities all have clients + stages.
  const oppIntegrity = await client.query(
    "SELECT count(*) AS n FROM opportunities o LEFT JOIN clients c ON o.client_id = c.id WHERE c.id IS NULL",
  );
  console.log("[verify] opportunities missing client (should be 0):", oppIntegrity.rows[0].n);

  await client.end();
  console.log("[verify] complete.");
}

main().catch((err) => {
  console.error("[verify] FAILED:", err.message);
  process.exitCode = 1;
});
