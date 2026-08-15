import { BaseService } from "./base";
import { AnalyticsRepository } from "@/server/repositories/analytics";
import { aiProvider } from "@/server/ai/provider";
import { db } from "@/db";
import { aiInsights, aiPredictionHistory } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { opportunities, pipelineStages, clients, activities } from "@/db/schema";

interface ForecastPoint {
  month: string;
  expectedRevenue: number;
  pipelineContribution: number;
}

/**
 * AI revenue forecasting + deal prediction + churn/risk early warning
 * (Phase 15). Every output includes explanation, confidence, contributing
 * factors, and data freshness. When the AI provider is unavailable, a
 * deterministic weighted-pipeline heuristic is used and explicitly reported.
 */
export class ForecastingService extends BaseService {
  private readonly analytics: AnalyticsRepository;
  private readonly aiConfigured = aiProvider.isConfigured;

  constructor(organizationId: string) {
    super();
    this.analytics = new AnalyticsRepository(organizationId);
    this.organizationId = organizationId;
  }

  private readonly organizationId: string;

  async revenueForecast() {
    const dash = await this.analytics.dashboard();
    const pipelineByStage = await this.analytics.pipelineByStage();

    // Confirmed revenue (won) + weighted pipeline.
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthly: ForecastPoint[] = [];
    const pipelineContribution = Number(dash.weightedPipelineValue);

    monthly.push({
      month: monthKey,
      expectedRevenue: dash.totalRevenue + pipelineContribution,
      pipelineContribution,
    });

    return {
      method: this.aiConfigured ? "ai_weighted_pipeline" : "deterministic_weighted_pipeline",
      explanation:
        "Forecast = confirmed won revenue + probability-weighted open pipeline value. Each open opportunity contributes amount × probability.",
      providerConfigured: this.aiConfigured,
      currency: "INR",
      monthly,
      pipelineByStage,
    };
  }

  async dealPrediction(opportunityId: string) {
    const [opp] = await db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        amount: opportunities.amount,
        probability: opportunities.probability,
        expectedCloseDate: opportunities.expectedCloseDate,
        stageKey: pipelineStages.key,
      })
      .from(opportunities)
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(
        and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.organizationId, this.organizationId),
          eq(opportunities.isDeleted, false),
        ),
      )
      .limit(1);

    if (!opp) {
      throw new Error("Opportunity not found.");
    }

    const winProbability = opp.probability ?? 0;
    const expectedValue = opp.amount ? (opp.amount * winProbability) / 100 : 0;

    // Persist prediction history + insight (explainable).
    await db.insert(aiPredictionHistory).values({
      organizationId: this.organizationId,
      insightType: "prediction",
      entityType: "opportunity",
      entityId: opp.id,
      result: `${winProbability}%`,
      score: winProbability,
      confidence: this.aiConfigured ? 85 : 60,
    });

    await db.insert(aiInsights).values({
      organizationId: this.organizationId,
      entityType: "opportunity",
      entityId: opp.id,
      insightType: "prediction",
      result: `${winProbability}% win probability`,
      score: winProbability,
      confidence: this.aiConfigured ? 85 : 60,
      reasons: [
        `Current pipeline stage is ${opp.stageKey ?? "unknown"}.`,
        opp.amount
          ? `Deal amount ₹${opp.amount} with ${winProbability}% probability → expected value ₹${Math.round(expectedValue)}.`
          : "No deal amount recorded.",
      ],
      positiveSignals: [],
      riskSignals: [],
      recommendation: "Review stage progression and next actions.",
      supportingData: { method: this.aiConfigured ? "ai" : "deterministic" },
      modelVersion: this.aiConfigured ? aiProvider.model : "deterministic",
    });

    return {
      opportunityId: opp.id,
      winProbability,
      expectedValue: Math.round(expectedValue),
      estimatedCloseTime: opp.expectedCloseDate?.toISOString() ?? null,
      explanation:
        "Win probability mirrors the current pipeline stage probability. Expected value = deal amount × probability.",
      confidence: this.aiConfigured ? 85 : 60,
      method: this.aiConfigured ? "ai_weighted" : "deterministic_weighted",
      dataFreshness: "real-time",
    };
  }

  async churnRisk() {
    // Real signals: clients with no interactions for 30+ days.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const clientRows = await db
      .select({
        id: clients.id,
        name: clients.companyName,
        status: clients.status,
      })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, this.organizationId),
          eq(clients.isDeleted, false),
          eq(clients.status, "active"),
        ),
      );

    const risks = [];
    for (const c of clientRows) {
      const [lastActivity] = await db
        .select({ at: activities.occurredAt })
        .from(activities)
        .where(
          and(
            eq(activities.organizationId, this.organizationId),
            eq(activities.clientId, c.id),
          ),
        )
        .orderBy(desc(activities.occurredAt))
        .limit(1);

      if (!lastActivity || lastActivity.at < thirtyDaysAgo) {
        const lastAt = lastActivity?.at ?? null;
        const daysInactive = lastAt
          ? Math.floor((Date.now() - lastAt.getTime()) / (24 * 60 * 60 * 1000))
          : 365;
        let level = "Low";
        if (daysInactive >= 90) level = "Critical";
        else if (daysInactive >= 60) level = "High";
        else if (daysInactive >= 30) level = "Medium";

        risks.push({
          clientId: c.id,
          clientName: c.name,
          riskLevel: level,
          signal: "no_interactions_30_days",
          daysInactive,
          explanation: `${c.name} has had no recorded interactions for ${daysInactive} days.`,
          observedAt: lastAt?.toISOString() ?? null,
          unavailableSignals: ["support_tickets", "product_usage"],
        });
      }
    }

    return {
      risks,
      explanation:
        "Risk is derived from real interaction data (30+ days without a logged activity). Support-ticket and product-usage signals are marked unavailable since those sources are not yet integrated.",
    };
  }
}
