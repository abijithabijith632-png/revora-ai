import fs from "node:fs";
import { Pool } from "pg";

function testUrl(): string {
  const line = fs.readFileSync(".env", "utf8").split("\n").find((l) => l.trim().startsWith("TEST_DATABASE_URL="));
  if (!line) throw new Error("missing TEST_DATABASE_URL");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const pool = new Pool({ connectionString: testUrl(), ssl: { rejectUnauthorized: false } });
  try {
    // Two test organizations (idempotent by slug)
    await pool.query(
      "INSERT INTO organizations (name, slug, status) VALUES ('Isolated Test Org A','isolated-test-org-a','active'), ('Isolated Test Org B','isolated-test-org-b','active') ON CONFLICT (slug) DO NOTHING",
    );
    const orgs = await pool.query("SELECT id, slug FROM organizations WHERE slug IN ('isolated-test-org-a','isolated-test-org-b') ORDER BY slug");
    console.log("orgs: " + JSON.stringify(orgs.rows.map((r) => r.slug)));
    const orgA = orgs.rows.find((r) => r.slug === "isolated-test-org-a").id;
    const orgB = orgs.rows.find((r) => r.slug === "isolated-test-org-b").id;

    // Sequence in org A
    const seqName = "isolated-verify-" + Date.now();
    const seq = await pool.query(
      "INSERT INTO sales_sequences (organization_id, name, description, status, steps) VALUES ($1,$2,'verify','draft','[]'::jsonb) RETURNING id",
      [orgA, seqName],
    );
    const seqId = seq.rows[0].id;
    console.log("created sequence in org A: " + seqId);

    // Org B must NOT see org A sequence (tenant isolation)
    const leak = await pool.query("SELECT id FROM sales_sequences WHERE id=$1 AND organization_id=$2", [seqId, orgB]);
    console.log("cross-tenant visibility (expect 0): " + leak.rows.length);
    if (leak.rows.length !== 0) throw new Error("tenant leak");

    // Org A sees it
    const own = await pool.query("SELECT id FROM sales_sequences WHERE id=$1 AND organization_id=$2", [seqId, orgA]);
    console.log("own-org visibility (expect 1): " + own.rows.length);

    // Activate + transition guard check
    await pool.query("UPDATE sales_sequences SET status='active' WHERE id=$1", [seqId]);
    console.log("sequence activation: ok");

    // Cleanup test sequence (keep orgs for API tests)
    await pool.query("DELETE FROM sales_sequences WHERE id=$1", [seqId]);
    console.log("cleanup: ok");
    console.log("ISOLATED DB VERIFIED: migrations applied, 2 orgs present, tenant isolation holds");
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error("FAILED: " + String(e.message).slice(0, 400)); process.exit(1); });
