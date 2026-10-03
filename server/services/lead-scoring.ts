import { and, desc, eq } from "drizzle-orm";
import { BaseService } from "./base";
import { LeadRepository } from "@/server/repositories/leads";
import { QualificationRepository } from "@/server/repositories/qualification";
import { db } from "@/db";
import { aiInsights, leads } from "@/db/schema";
import { aiProvider } from "@/server/ai/provider";
import { buildScoringContext, buildPrompt } from "@/server/ai/scoring-context";
import { aiScoreResponseSchema, normalizeFactorKeys, scoreToLevel } from "@/server/ai/score-schema";
import { recordAudit } from "@/lib/api/audit";
import { ValidationError } from "@/lib/errors";
import { parseAndValidate } from "@/lib/validation";

/**
 * AI Lead Scoring service — tenant-scoped, evidence-based, explainable.
 * Orchestrates input building, provider invocation, strict validation,
 * persistence (aiInsights + leads.aiScore* snapshot), and audit.
 */

export class LeadScoringService extends BaseService {
  private readonly leadRepo: LeadRepository;
  private readonly qualRepo: QualificationRepository;

  constructor(organizationId: string) {
    super();
    this.leadRepo = new LeadRepository(organizationId);
    this.qualRepo = new QualificationRepository(organizationId);
  }

  /** Latest score + history for a lead (tenant-scoped). */
  async getForLead(leadId: string) {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) return null;

    const history = await db
      .select({
        id: aiInsights.id,
        score: aiInsights.score,
        result: aiInsights.result,
        confidence: aiInsights.confidence,
        reasons: aiInsights.reasons,
        positiveSignals: aiInsights.positiveSignals,
        riskSignals: aiInsights.riskSignals,
        recommendation: aiInsights.recommendation,
        supportingData: aiInsights.supportingData,
        modelVersion: aiInsights.modelVersion,
        createdAt: aiInsights.createdAt,
      })
      .from(aiInsights)
      .where(
        and(
          eq(aiInsights.organizationId, this.leadRepo.orgId),
          eq(aiInsights.entityType, "lead"),
          eq(aiInsights.entityId, leadId),
          eq(aiInsights.insightType, "lead_score"),
        ),
      )
      .orderBy(desc(aiInsights.createdAt));

    return {
      latest: history[0] ?? null,
      history,
    };
  }

  async score(actor: { userId: string }, leadId: string) {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new ValidationError("Lead not found.");

    const qualification = await this.qualRepo.findByLeadId(leadId);
    const latestQualification = qualification[0] ?? null;

    // Engagement: reuse available activities (count + last activity).
    const engagement = await this.leadRepo.getEngagementSummary(leadId);

    const context = buildScoringContext(
      lead,
      { latest: latestQualification },
      engagement,
    );

    const prompt = buildPrompt(context);
    let parsed: ReturnType<typeof parseAndValidate<typeof aiScoreResponseSchema>>;
    let provenance: string;
    if (context.availableFields < 4 || !aiProvider.isConfigured) {
      parsed = this.insufficientDataScore(context.availableFields, context.totalFields);
      provenance = context.availableFields < 4 ? "deterministic_insufficient_data" : "deterministic_provider_unavailable";
    } else {
      try {
        const raw = await aiProvider.generateStructured({ system: prompt.system, user: prompt.user, jsonMode: true });
        const reasons = normalizeFactorKeys(Array.isArray(raw?.reasons) ? (raw.reasons as unknown[]) : []);
        parsed = parseAndValidate(aiScoreResponseSchema, { ...(raw as Record<string, unknown>), reasons });
        provenance = "provider_assisted";
      } catch {
        parsed = this.insufficientDataScore(context.availableFields, context.totalFields);
        provenance = "deterministic_provider_fallback";
      }
    }

    // Persist transactionally: history + latest snapshot.
    await db.transaction(async (tx) => {
      await tx.insert(aiInsights).values({
        organizationId: this.leadRepo.orgId,
        entityType: "lead",
        entityId: leadId,
        insightType: "lead_score",
        result: parsed.level,
        score: parsed.score,
        confidence: parsed.confidence != null ? Math.round(parsed.confidence * 100) : null,
        reasons: parsed.reasons.map((r) => r.explanation),
        positiveSignals: parsed.positiveSignals,
        riskSignals: parsed.riskSignals,
        recommendation: parsed.summary,
        supportingData: {
          factors: parsed.reasons,
          dataQuality: parsed.dataQuality,
          availableFields: context.availableFields,
          totalFields: context.totalFields,
          provenance,
        },
        modelVersion: provenance === "provider_assisted" ? aiProvider.model : provenance,
      });

      await tx
        .update(leads)
        .set({
          aiScore: parsed.score,
          aiScoreCategory: scoreToLevel(parsed.score),
          aiScoreConfidence:
            parsed.confidence != null ? Math.round(parsed.confidence * 100) : null,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
    });

    await recordAudit({
      organizationId: this.leadRepo.orgId,
      userId: actor.userId,
      action: "approve",
      entityType: "lead",
      entityId: leadId,
      metadata: { aiScore: parsed.score, provenance },
    });

    return this.getForLead(leadId);
  }

  private insufficientDataScore(availableFields: number, totalFields: number) {
    const score = Math.min(35, Math.round((availableFields / Math.max(1, totalFields)) * 35));
    return {
      score,
      level: scoreToLevel(score),
      confidence: 0.15,
      dataQuality: Math.round((availableFields / Math.max(1, totalFields)) * 100),
      reasons: [{ factor: "historical_signal" as const, label: "Limited CRM evidence", impact: "neutral" as const,
        explanation: "There is not enough verified CRM information for a reliable lead score.", evidence: `${availableFields} of ${totalFields} context fields available` }],
      summary: "Insufficient verified data for a reliable score. Complete the lead profile and log engagement before relying on this estimate.",
      riskSignals: [],
      positiveSignals: [],
    };
  }
}
