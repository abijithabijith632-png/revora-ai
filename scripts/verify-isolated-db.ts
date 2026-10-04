/** Read-only verification of the isolated database against the current Drizzle schema. */

const EXPECTED_HOST = "ep-muddy-cherry-b5tgb59p-pooler.c-7.us-east-2.aws.neon.tech";
const EXPECTED_DATABASE = "neondb";
const PROD_MARKERS = ["revora-ai-omega", "autumn-king"];

async function getCurrentSchemaTables() {
  const schema = await import("../db/schema");
  const { getTableConfig } = await import("drizzle-orm/pg-core");
  return Object.values(schema).flatMap((value) => {
    try {
      const table = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
      return [{ name: table.name, columns: table.columns.map((column) => column.name) }];
    } catch {
      return [];
    }
  });
}

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL ?? "";
  if (!testUrl) {
    console.error("Set TEST_DATABASE_URL to the isolated database. Refusing to use DATABASE_URL.");
    process.exit(2);
  }

  let target: URL;
  try {
    target = new URL(testUrl);
  } catch {
    console.error("TEST_DATABASE_URL is not a valid URL.");
    process.exit(2);
    return;
  }
  const host = target.host;
  const database = target.pathname.replace(/^\//, "");
  console.log(`Target host/database: ${host} / ${database}`);
  if (host !== EXPECTED_HOST || database !== EXPECTED_DATABASE) {
    console.error("Target does not match the isolated SHE CRM TEST database.");
    process.exit(2);
  }
  if (PROD_MARKERS.some((marker) => host.includes(marker))) {
    console.error("Target matches a production host marker.");
    process.exit(2);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: testUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("SELECT 1");
    console.log("connection: PASS");

    const expectedTables = await getCurrentSchemaTables();
    const actual = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const actualColumns = new Map<string, Set<string>>();
    for (const row of actual.rows as Array<{ table_name: string; column_name: string }>) {
      const columns = actualColumns.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      actualColumns.set(row.table_name, columns);
    }

    const missingTables: string[] = [];
    const missingColumns: string[] = [];
    for (const table of expectedTables) {
      const columns = actualColumns.get(table.name);
      if (!columns) {
        missingTables.push(table.name);
        continue;
      }
      for (const column of table.columns) {
        if (!columns.has(column)) missingColumns.push(`${table.name}.${column}`);
      }
    }

    console.log(`current schema tables expected: ${expectedTables.length}`);
    console.log(`missing required tables: ${JSON.stringify(missingTables)}`);
    console.log(`missing required columns: ${JSON.stringify(missingColumns)}`);
    console.log(`users.phone: ${actualColumns.get("users")?.has("phone") ? "PASS" : "FAIL"}`);
    console.log(`users.location: ${actualColumns.get("users")?.has("location") ? "PASS" : "FAIL"}`);
    const obsoleteTables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'sales_sequence%' ORDER BY tablename",
    );
    console.log(`Sales Sequence tables present: ${JSON.stringify(obsoleteTables.rows.map((row: { tablename: string }) => row.tablename))}`);
    console.log("Sales Sequence tables required: no");
    console.log("Production database: not accessed; DATABASE_URL is not read");
    if (missingTables.length || missingColumns.length) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const err = error as Error;
  console.error(`verify failed: ${err.name}: ${err.message.slice(0, 300)}`);
  process.exit(1);
});
