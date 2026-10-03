import { BaseService } from "./base";
import { AnalyticsRepository } from "@/server/repositories/analytics";
import { db } from "@/db";
import { aiInsights, aiPredictionHistory } from "@/db/schema";
import { eq, and, desc, inArray, isNull, or, gte } from "drizzle-orm";
import { opportunities, pipelineStages, clients, activities, opportunityStageHistory, tasks, followups } from "@/db/schema";

interface ForecastPoint {
  month: string;
  expectedRevenue: number;
  pipelineContribution: number;
}

/**
 * Deterministic CRM forecast and explainable deal risk signals.
 */
export class ForecastingService extends BaseService {
  private readonly analytics: AnalyticsRepository;

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
      method: "deterministic_weighted_pipeline",
      methodLabel: "Deterministic CRM forecast",
      explanation:
        "Forecast = confirmed won revenue + probability-weighted open pipeline value. Each open opportunity contributes amount × probability.",
      providerConfigured: false,
      wonRevenue: dash.totalRevenue,
      pipelineValue: dash.totalPipelineValue,
      weightedPipelineValue: pipelineContribution,
      confidence: null,
      confidenceNote: "No calibrated historical model is configured.",
      keyFactors: ["Won revenue", "Opportunity amount × recorded probability"],
      riskFactors: ["Forecast depends on CRM stage probabilities and data completeness."],
      guaranteed: false,
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
      confidence: null,
    });

    await db.insert(aiInsights).values({
      organizationId: this.organizationId,
      entityType: "opportunity",
      entityId: opp.id,
      insightType: "prediction",
      result: `${winProbability}% win probability`,
      score: winProbability,
      confidence: null,
      reasons: [
        `Current pipeline stage is ${opp.stageKey ?? "unknown"}.`,
        opp.amount
          ? `Deal amount ₹${opp.amount} with ${winProbability}% probability → expected value ₹${Math.round(expectedValue)}.`
          : "No deal amount recorded.",
      ],
      positiveSignals: [],
      riskSignals: [],
      recommendation: "Review stage progression and next actions.",
      supportingData: { method: "deterministic_stage_probability" },
      modelVersion: "deterministic-v1",
    });

    return {
      opportunityId: opp.id,
      winProbability,
      expectedValue: Math.round(expectedValue),
      estimatedCloseTime: opp.expectedCloseDate?.toISOString() ?? null,
      explanation:
        "Win probability mirrors the current pipeline stage probability. Expected value = deal amount × probability.",
      confidence: null,
      method: "deterministic_stage_probability",
      dataFreshness: "real-time",
    };
  }

  /** Opportunity risks derived only from tenant-scoped CRM records. */
  async dealRisks() {
    const rows = await db.select({
      id: opportunities.id, name: opportunities.name, amount: opportunities.amount,
      ownerId: opportunities.ownerId,
      closeDate: opportunities.expectedCloseDate, updatedAt: opportunities.updatedAt,
      stageName: pipelineStages.name,
    }).from(opportunities)
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(and(eq(opportunities.organizationId, this.organizationId), eq(opportunities.isDeleted, false),
        or(isNull(pipelineStages.id), eq(pipelineStages.isTerminal, false))))
      .orderBy(desc(opportunities.amount)).limit(500);
    if (!rows.length) return { method: "deterministic_crm_signals", generatedAt: new Date().toISOString(), insufficientData: true, truncated: false, risks: [] };

    const ids = rows.map((r) => r.id);
    const [activityRows, historyRows, followupRows, taskRows] = await Promise.all([
      db.select({ id: activities.opportunityId, at: activities.occurredAt }).from(activities)
        .where(and(eq(activities.organizationId, this.organizationId), inArray(activities.opportunityId, ids)))
        .orderBy(desc(activities.occurredAt)),
      db.select({ id: opportunityStageHistory.opportunityId, at: opportunityStageHistory.changedAt }).from(opportunityStageHistory)
        .where(and(eq(opportunityStageHistory.organizationId, this.organizationId), inArray(opportunityStageHistory.opportunityId, ids)))
        .orderBy(desc(opportunityStageHistory.changedAt)),
      db.select({ id: followups.opportunityId, scheduledAt: followups.scheduledAt, status: followups.status }).from(followups)
        .where(and(eq(followups.organizationId, this.organizationId), inArray(followups.opportunityId, ids))),
      db.select({ id: tasks.opportunityId, dueDate: tasks.dueDate, status: tasks.status }).from(tasks)
        .where(and(eq(tasks.organizationId, this.organizationId), inArray(tasks.opportunityId, ids))),
    ]);
    const firstDate = (items: Array<{ id: string | null; at: Date }>) => {
      const dates = new Map<string, Date>();
      for (const item of items) if (item.id && !dates.has(item.id)) dates.set(item.id, item.at);
      return dates;
    };
    const lastActivity = firstDate(activityRows);
    const lastStageChange = firstDate(historyRows);
    const now = new Date();
    const ageDays = (date?: Date) => date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000)) : null;
    const risks = rows.map((row) => {
      let riskScore = 0;
      const reasons: string[] = [];
      const activityAge = ageDays(lastActivity.get(row.id));
      const stageAge = ageDays(lastStageChange.get(row.id));
      if (activityAge === null) { riskScore += 30; reasons.push("No activity is recorded."); }
      else if (activityAge >= 30) { riskScore += 30; reasons.push(`No activity recorded for ${activityAge} days.`); }
      else if (activityAge >= 14) { riskScore += 15; reasons.push(`Last activity was ${activityAge} days ago.`); }
      if (stageAge !== null && stageAge >= 45) { riskScore += 25; reasons.push(`No stage movement recorded for ${stageAge} days.`); }
      else if (stageAge === null) reasons.push("Stage history is unavailable, so stage stagnation could not be assessed.");
      if (followupRows.some((f) => f.id === row.id && f.status === "pending" && f.scheduledAt < now) ||
          taskRows.some((t) => t.id === row.id && t.status !== "completed" && t.dueDate && t.dueDate < now)) {
        riskScore += 20; reasons.push("A linked follow-up or task is overdue.");
      }
      if (row.closeDate && row.closeDate < now) { riskScore += 25; reasons.push("Expected close date has passed while the deal remains open."); }
      riskScore = Math.min(100, riskScore);
      return { opportunityId: row.id, opportunityName: row.name, ownerId: row.ownerId, stage: row.stageName, amount: row.amount,
        riskScore, riskLevel: riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low", reasons,
        recommendedAction: reasons.length ? "Review the deal and record a dated next step." : "Continue the current sales plan.",
        confidence: activityAge === null || stageAge === null ? "low" : "moderate", method: "deterministic_crm_signals" };
    });
    return { method: "deterministic_crm_signals", generatedAt: now.toISOString(), insufficientData: false, truncated: rows.length === 500, risks };
  }

  async pipelineIntelligence() {
    const [risk, pipelineByStage] = await Promise.all([this.dealRisks(), this.analytics.pipelineByStage()]);
    const recentPipelineChanges = await db.select({ opportunityId: opportunityStageHistory.opportunityId,
      opportunityName: opportunities.name, amount: opportunities.amount,
      previousProbability: opportunityStageHistory.previousProbability,
      newProbability: opportunityStageHistory.newProbability, changedAt: opportunityStageHistory.changedAt })
      .from(opportunityStageHistory).innerJoin(opportunities, eq(opportunities.id, opportunityStageHistory.opportunityId))
      .where(and(eq(opportunityStageHistory.organizationId, this.organizationId), eq(opportunities.organizationId, this.organizationId),
        gte(opportunityStageHistory.changedAt, new Date(Date.now() - 7 * 86400000))))
      .orderBy(desc(opportunityStageHistory.changedAt)).limit(50);
    const stalledOpportunities = risk.risks.filter((r) => r.riskScore >= 30);
    const bottleneck = [...pipelineByStage].sort((a, b) => b.count - a.count)[0] ?? null;
    const highValueOpportunities = [...risk.risks].filter((r) => (r.amount ?? 0) > 0)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 5);
    return { method: "deterministic_crm_analytics", generatedAt: risk.generatedAt,
      pipelineByStage, stalledOpportunities, highValueOpportunities,
      recentPipelineChanges: recentPipelineChanges.map((change) => ({ ...change,
        weightedValueChange: change.amount != null && change.previousProbability != null && change.newProbability != null
          ? Math.round(change.amount * (change.newProbability - change.previousProbability) / 100) : null,
        opportunityUrl: `/opportunities/${change.opportunityId}` })),
      bottleneck: bottleneck ? { stage: bottleneck.stageName, opportunityCount: bottleneck.count, value: bottleneck.value } : null };
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
