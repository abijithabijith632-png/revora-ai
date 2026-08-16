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
 *
 * IMPORTANT: the `Pool` and Drizzle `db` instances are created lazily (on first
 * real use) rather than at module load. This lets Vercel's build-time page-data
 * collection evaluate server route modules without requiring `DATABASE_URL` to
 * be set yet. The first actual database query will still surface a clear error
 * if the connection string is missing.
 */

type Database = ReturnType<typeof drizzle<typeof schema>>;

// Global singleton to avoid duplicate pools during dev hot-reload.
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: Database;
};

function createPool(): Pool {
  const connectionString = serverEnv.databaseUrl;

  // Supabase and most hosted Postgres providers require TLS. Local dev
  // (localhost) does not. Enable SSL for any remote host so the pooler works
  // out of the box; `rejectUnauthorized: false` keeps the connection encrypted
  // while tolerating hosted-provider certificate chains.
  let hostname = "localhost";
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    // Keep the safe default when the connection string cannot be parsed.
  }
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
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

function getPool(): Pool {
  return (globalForDb.pool ??= createPool());
}

function getDb(): Database {
  return (globalForDb.db ??= drizzle(getPool(), { schema }));
}

/**
 * Lazily-initialized wrapper. Importing this module (and these exports) does
 * NOT open a connection or read `DATABASE_URL`. Initialization happens on the
 * first property/method access.
 */
function lazyProxy<T extends object>(init: () => T): T {
  let instance: T | undefined;

  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const target = (instance ??= init());

      if (typeof prop === "symbol") {
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      }

      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === "function" ? (value as Function).bind(target) : value;
    },
    has(_target, prop) {
      return prop in (instance ??= init());
    },
  });
}

export const pool = lazyProxy<Pool>(getPool);

export const db = lazyProxy<Database>(getDb);

export type { Database };
export { schema };
