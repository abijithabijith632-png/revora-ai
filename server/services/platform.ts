import { sql } from "drizzle-orm";
import { db } from "@/db";
import { BaseService } from "./base";
import { PlatformRepository } from "@/server/repositories/billing";
import { pool } from "@/db";
import { aiProvider } from "@/server/ai/provider";
import { emailProvider } from "@/server/email/provider";
import { paymentProvider } from "@/server/billing/provider";
import {
  users,
  leads,
  opportunities,
  aiInsights,
} from "@/db/schema";

/**
 * Platform administration service (Phase 16).
 * Provides aggregate platform metrics and real system health. Fully separated
 * from org admin; callers must verify `users.isPlatformAdmin`.
 */
export class PlatformService extends BaseService {
  private readonly repo = new PlatformRepository();

  async telemetry() {
    const overview = await this.repo.overview();

    const [leadsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads);

    const [oppsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opportunities);

    const [aiRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiInsights);

    const [usersRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    return {
      ...overview,
      totalUsers: usersRow?.count ?? 0,
      leadsCreated: leadsRow?.count ?? 0,
      opportunitiesCreated: oppsRow?.count ?? 0,
      aiUsage: aiRow?.count ?? 0,
      // Metrics that cannot be measured with the current architecture are
      // explicitly marked unavailable rather than fabricated.
      monthlyActiveUsers: null,
      closedDealValue: null,
      platformRevenue: null,
      storageUsage: null,
      unavailableMetrics: [
        "monthlyActiveUsers",
        "closedDealValue",
        "platformRevenue",
        "storageUsage",
      ],
    };
  }

  async health() {
    let database: "up" | "down" = "down";
    try {
      await pool.query("SELECT 1");
      database = "up";
    } catch {
      database = "down";
    }

    return {
      status: database === "up" ? "ok" : "degraded",
      service: "revora-ai-platform",
      checks: {
        api: "up",
        database,
        ai: aiProvider.isConfigured ? "configured" : "not_configured",
        email: emailProvider.isConfigured() ? "configured" : "not_configured",
        payment: paymentProvider.isConfigured() ? "configured" : "not_configured",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
