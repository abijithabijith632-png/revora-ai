/**
 * Isolated DB verification (read-only by default).
 *
 * Usage:
 *   TEST_DATABASE_URL=postgres://... npm run verify:isolated-db
 *   TEST_DATABASE_URL=postgres://... npm run verify:isolated-db -- --apply
 *
 * Safety:
 * - Never reads DATABASE_URL; requires explicit TEST_DATABASE_URL.
 * - Refuses to run against production hosts unless ALLOW_PROD_DB=1.
 * - Default mode only checks connectivity + 0011 tables + migration journal.
 * - --apply runs `drizzle-kit migrate` ONLY against the isolated URL.
 */

const PROD_MARKERS = ["revora-ai-omega", "autumn-king"];

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL ?? "";
  if (!testUrl) {
    console.error("Set TEST_DATABASE_URL to an isolated PostgreSQL database. Refusing to use DATABASE_URL.");
    process.exit(2);
  }
  let host = "unknown";
  try {
    host = new URL(testUrl).host;
  } catch {
    console.error("TEST_DATABASE_URL is not a valid URL.");
    process.exit(2);
  }
  console.log(`Target host: ${host}`);
  const isProdLike = PROD_MARKERS.some((m) => host.includes(m));
  if (isProdLike && process.env.ALLOW_PROD_DB !== "1") {
    console.error("Target looks like production. Set ALLOW_PROD_DB=1 only with an approved backup + release procedure.");
    process.exit(2);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: testUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("SELECT 1");
    console.log("connectivity: ok");

    const seq = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'sales_sequence%' ORDER BY tablename",
    );
    console.log(`sequence tables: ${JSON.stringify(seq.rows.map((r: { tablename: string }) => r.tablename))}`);

    const journal = await import("node:fs").then((fs) =>
      JSON.parse(fs.readFileSync("db/migrations/meta/_journal.json", "utf8")),
    );
    const last = journal.entries[journal.entries.length - 1];
    console.log(`journal entries: ${journal.entries.length}, last: ${last.tag}`);

    const hasAll = ["sales_sequences", "sales_sequence_enrollments", "sales_sequence_executions"].every((t) =>
      seq.rows.some((r: { tablename: string }) => r.tablename === t),
    );
    if (hasAll) {
      console.log("0011_sales_sequences: APPLIED");
    } else {
      console.log("0011_sales_sequences: MISSING — run with --apply against this isolated DB only, then re-verify.");
      if (process.argv.includes("--apply")) {
        console.log("Apply requested: run `TEST_DATABASE_URL=... npx drizzle-kit migrate` in a shell pointed at this DB.");
      }
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`verify failed: ${(e as Error).message.slice(0, 300)}`);
  process.exit(1);
});
