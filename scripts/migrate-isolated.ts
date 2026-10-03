import fs from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

function getTestUrl(): string {
  const pick = (file: string) => {
    try {
      const line = fs
        .readFileSync(file, "utf8")
        .split("\n")
        .find((l) => l.trim().startsWith("TEST_DATABASE_URL="));
      if (!line) return "";
      return line.slice(line.indexOf("=") + 1).trim().replace(/^"|"$/g, "");
    } catch {
      return "";
    }
  };
  const fromEnv = process.env.TEST_DATABASE_URL ?? "";
  const url = fromEnv || pick(".env") || pick(".env.local");
  if (!url) throw new Error("TEST_DATABASE_URL missing");
  const host = new URL(url).host;
  console.log(`Migrating isolated host: ${host}`);
  if (host.includes("autumn-king") && process.env.ALLOW_PROD_DB !== "1") {
    throw new Error("Refusing to migrate production-like host");
  }
  return url;
}

async function main() {
  const url = getTestUrl();
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "db/migrations" });
  console.log("migrate: done");
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'sales_sequence%' ORDER BY tablename",
  );
  console.log("sequence tables: " + JSON.stringify(tables.rows.map((r) => r.tablename)));
  const count = await pool.query("SELECT count(*)::int as c FROM pg_tables WHERE schemaname='public'");
  console.log("total tables: " + count.rows[0].c);
  await pool.end();
}

main().catch((e) => {
  console.error("migrate failed: " + String((e as Error).message).slice(0, 500));
  process.exit(1);
});
