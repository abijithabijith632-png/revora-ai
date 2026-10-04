import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  const target = new URL(url);
  const host = target.host;
  const database = target.pathname.replace(/^\//, "");
  console.log(`Migrating isolated host/database: ${host} / ${database}`);
  if (host !== "ep-muddy-cherry-b5tgb59p-pooler.c-7.us-east-2.aws.neon.tech" || database !== "neondb") {
    throw new Error("Refusing unexpected isolated database target");
  }
  return url;
}

async function createCurrentAppMigrationsFolder(): Promise<string> {
  const sourceFolder = path.resolve("db/migrations");
  const journal = JSON.parse(fs.readFileSync(path.join(sourceFolder, "meta", "_journal.json"), "utf8"));
  const entries = journal.entries.filter((entry: { tag: string }) => entry.tag !== "0011_sales_sequences");
  if (entries.length === journal.entries.length) throw new Error("Expected obsolete 0011 migration was not found");

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "she-crm-test-migrations-"));
  fs.mkdirSync(path.join(folder, "meta"), { recursive: true });
  fs.writeFileSync(path.join(folder, "meta", "_journal.json"), JSON.stringify({
    ...journal,
    entries: entries.map((entry: { idx: number }, idx: number) => ({ ...entry, idx })),
  }, null, 2));
  for (const entry of entries) {
    fs.copyFileSync(path.join(sourceFolder, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
  }
  console.log(`Test migration set: ${entries.length} current migrations; 0011_sales_sequences excluded`);
  return folder;
}

async function main() {
  const url = getTestUrl();
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);
  const migrationsFolder = await createCurrentAppMigrationsFolder();
  try {
    await migrate(db, { migrationsFolder });
    console.log("migrate: done");
  } finally {
    await pool.end();
    fs.rmSync(migrationsFolder, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("migrate failed: " + String((e as Error).message).slice(0, 500));
  process.exit(1);
});
