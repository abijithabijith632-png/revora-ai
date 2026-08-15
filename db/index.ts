import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { serverEnv } from "@/config/env";

/**
 * Database connection factory.
 *
 * A single pooled Postgres connection is created lazily and reused across the
 * server. The `serverEnv.databaseUrl` value must NEVER be exposed to the
 * browser — this module is imported by server-side code only.
 */

// Global singleton to avoid duplicate pools during dev hot-reload.
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createPool(): Pool {
  const pool = new Pool({
    connectionString: serverEnv.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", (err) => {
    console.error("[db:error] Unexpected Postgres pool error", {
      message: err.message,
    });
  });

  return pool;
}

export const pool = (globalForDb.pool ??= createPool());

export const db = (globalForDb.db ??= drizzle(pool, { schema }));

export type Database = typeof db;
export { schema };
