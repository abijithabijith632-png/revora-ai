import { success } from "@/lib/api";
import { serverEnv } from "@/config/env";
import { pool } from "@/db";

/**
 * Health/readiness endpoint — indicates application + database availability.
 * Never exposes credentials or internal details.
 */
export async function GET() {
  let database: "up" | "down" = "down";
  try {
    await pool.query("SELECT 1");
    database = "up";
  } catch {
    database = "down";
  }

  const healthy = database === "up";

  return success(
    {
      status: healthy ? "ok" : "degraded",
      service: "revora-ai-api",
      environment: serverEnv.nodeEnv,
      database,
      timestamp: new Date().toISOString(),
    },
    { message: healthy ? "Revora AI server is running." : "Service degraded." },
  );
}
