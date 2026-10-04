import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activities, aiInsights, clients, communications, contacts, followups, leads, meetings, opportunities, opportunityStageHistory, pipelineStages, proposals, tasks, users } from "@/db/schema";
import { aiProvider } from "@/server/ai/provider";
import { calculateBuyingIntent } from "@/server/ai/buying-intent";
import { ForecastingService } from "@/server/services/forecasting";
import { ConfigurationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { parseAndValidate } from "@/lib/validation";

const resultSchema = z.object({ summary: z.string().min(1).max(700), relationshipStatus: z.string().min(1).max(120), recommendedActions: z.array(z.string().min(1).max(220)).max(5) });
const briefSchema = z.object({ summary: z.string().min(1).max(700), recommendations: z.array(z.string().min(1).max(220)).max(5) });

export class Phase3IntelligenceService {
  constructor(private readonly orgId: string) {}
  async account(id: string) {
    const [account] = await db.select({ id: clients.id, name: clients.companyName, status: clients.status, vip: clients.vipFlag, notes: clients.notes, updatedAt: clients.updatedAt }).from(clients).where(and(eq(clients.id, id), eq(clients.organizationId, this.orgId), eq(clients.isDeleted, false))).limit(1);
    if (!account) throw new NotFoundError("Account not found.");
    const [people, deals, events, meetingsToday, followupRows, tasksToday, proposalRows, engagementRows, saved] = await Promise.all([
      db.select({ id: contacts.id, name: contacts.firstName, lastName: contacts.lastName, title: contacts.designation, primary: contacts.isPrimary }).from(contacts).where(and(eq(contacts.organizationId, this.orgId), eq(contacts.clientId, id), eq(contacts.isDeleted, false))).limit(10),
      db.select({ id: opportunities.id, name: opportunities.name, amount: opportunities.amount, stage: pipelineStages.name, updatedAt: opportunities.updatedAt }).from(opportunities).leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id)).where(and(eq(opportunities.organizationId, this.orgId), eq(opportunities.clientId, id), eq(opportunities.isDeleted, false), isNull(opportunities.closedAt))).orderBy(desc(opportunities.updatedAt)).limit(20),
      db.select({ id: activities.id, subject: activities.subject, type: activities.type, occurredAt: activities.occurredAt }).from(activities).where(and(eq(activities.organizationId, this.orgId), eq(activities.clientId, id))).orderBy(desc(activities.occurredAt)).limit(10),
      db.select({ id: meetings.id, title: meetings.title, scheduledAt: meetings.scheduledAt, updatedAt: meetings.updatedAt }).from(meetings).innerJoin(leads, and(eq(leads.id, meetings.leadId), eq(leads.organizationId, this.orgId))).innerJoin(clients, and(eq(clients.sourceLeadId, leads.id), eq(clients.organizationId, this.orgId))).where(and(eq(meetings.organizationId, this.orgId), eq(clients.id, id), eq(leads.isDeleted, false), isNull(leads.mergedIntoId), gte(meetings.scheduledAt, new Date()), eq(meetings.status, "scheduled"))).orderBy(meetings.scheduledAt).limit(10),
      db.select({ id: followups.id, scheduledAt: followups.scheduledAt, action: followups.actionDescription, updatedAt: followups.updatedAt }).from(followups).where(and(eq(followups.organizationId, this.orgId), eq(followups.clientId, id), eq(followups.status, "pending"))).orderBy(followups.scheduledAt).limit(15),
      db.select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, updatedAt: tasks.updatedAt }).from(tasks).where(and(eq(tasks.organizationId, this.orgId), eq(tasks.clientId, id), inArray(tasks.status, ["pending", "in_progress", "overdue"]))).limit(15),
      db.select({ id: proposals.id, title: proposals.title, status: proposals.status, updatedAt: proposals.updatedAt }).from(proposals).where(and(eq(proposals.organizationId, this.orgId), eq(proposals.clientId, id))).orderBy(desc(proposals.updatedAt)).limit(10),
      db.select({ openedAt: communications.openedAt, clickedAt: communications.clickedAt, updatedAt: communications.updatedAt }).from(communications).where(and(eq(communications.organizationId, this.orgId), eq(communications.clientId, id))).orderBy(desc(communications.updatedAt)).limit(10),
      db.select({ id: aiInsights.id, result: aiInsights.result, recommendation: aiInsights.recommendation, modelVersion: aiInsights.modelVersion, createdAt: aiInsights.createdAt, supportingData: aiInsights.supportingData }).from(aiInsights).where(and(eq(aiInsights.organizationId, this.orgId), eq(aiInsights.entityType, "client"), eq(aiInsights.entityId, id), eq(aiInsights.insightType, "client_summary"))).orderBy(desc(aiInsights.createdAt)).limit(1),
    ]);
    const stageMoves = deals.length ? await db.select({ opportunityId: opportunityStageHistory.opportunityId, changedAt: opportunityStageHistory.changedAt, reason: opportunityStageHistory.reason }).from(opportunityStageHistory).where(and(eq(opportunityStageHistory.organizationId, this.orgId), inArray(opportunityStageHistory.opportunityId, deals.map((x) => x.id)), gte(opportunityStageHistory.changedAt, new Date(Date.now() - 30 * 86400000)))).orderBy(desc(opportunityStageHistory.changedAt)).limit(10) : [];
    const sourceFreshAt = [account.updatedAt, ...events.map((x) => x.occurredAt), ...deals.map((x) => x.updatedAt), ...proposalRows.map((x) => x.updatedAt), ...meetingsToday.map((x) => x.updatedAt), ...followupRows.map((x) => x.updatedAt), ...tasksToday.map((x) => x.updatedAt), ...engagementRows.map((x) => x.updatedAt), ...stageMoves.map((x) => x.changedAt)].reduce((a, b) => a > b ? a : b, account.updatedAt).toISOString();
    const insight = saved[0] ?? null;
    return { account, contacts: people, opportunities: deals, activities: events, meetings: meetingsToday, followups: followupRows, tasks: tasksToday, proposals: proposalRows, communications: engagementRows, stageMoves, signals: [events.length + " activity records", deals.length + " open opportunities", meetingsToday.length + " upcoming meetings", followupRows.some((x) => x.scheduledAt < new Date()) ? "Overdue follow-ups" : null, engagementRows.some((x) => x.openedAt || x.clickedAt) ? "Recorded email engagement" : null, stageMoves.length ? stageMoves.length + " recent opportunity stage movements" : null].filter(Boolean), insight, sourceFreshAt, stale: Boolean(insight && insight.createdAt.toISOString() < sourceFreshAt), aiUnavailable: !aiProvider.isConfigured };
  }
  async refreshAccount(id: string, actor: string) {
    const d = await this.account(id);
    const prior = d.insight?.supportingData as { sourceFreshAt?: string; summary?: string } | null;
    if (d.insight && prior?.sourceFreshAt === d.sourceFreshAt) return { summary: prior.summary ?? d.insight.result, relationshipStatus: d.insight.result, recommendedActions: d.insight.recommendation ? [d.insight.recommendation] : [], id: d.insight.id, generatedAt: d.insight.createdAt.toISOString(), sourceFreshAt: d.sourceFreshAt, method: d.insight.modelVersion ?? "stored_insight", cached: true };
    let value = { summary: d.account.name + " is " + d.account.status + (d.account.vip ? " and marked VIP." : "."), relationshipStatus: d.signals.join("; "), recommendedActions: d.followups.filter((x) => x.scheduledAt < new Date()).map((x) => x.action ?? "Complete overdue follow-up").slice(0, 3) };
    let model = "deterministic_crm_fallback";
    if (aiProvider.isConfigured && (d.activities.length + d.opportunities.length + d.followups.length + d.proposals.length)) try {
      value = parseAndValidate(resultSchema, await aiProvider.generateStructured({ jsonMode: true, system: "Summarize this account using only CRM records. Do not infer news, revenue, sentiment, employees, or competitors. Return JSON summary, relationshipStatus, recommendedActions.", user: JSON.stringify({ account: d.account, contacts: d.contacts, opportunities: d.opportunities, activities: d.activities, meetings: d.meetings, followups: d.followups, tasks: d.tasks, proposals: d.proposals, communications: d.communications.map((x) => ({ opened: Boolean(x.openedAt), clicked: Boolean(x.clickedAt) })), stageMoves: d.stageMoves }) }));
      model = aiProvider.model;
    } catch { model = "deterministic_provider_fallback"; }
    const [row] = await db.insert(aiInsights).values({ organizationId: this.orgId, entityType: "client", entityId: id, insightType: "client_summary", result: value.relationshipStatus.slice(0, 255), reasons: d.signals as string[], recommendation: value.recommendedActions.join(" "), supportingData: { summary: value.summary, generatedBy: actor, sourceFreshAt: d.sourceFreshAt }, modelVersion: model }).returning({ id: aiInsights.id, createdAt: aiInsights.createdAt });
    return { ...value, id: row.id, generatedAt: row.createdAt.toISOString(), sourceFreshAt: d.sourceFreshAt, method: model };
  }
  async intent(id: string, user: { userId: string; roleNames: string[] }) {
    const [lead] = await db.select({ id: leads.id, name: leads.fullName }).from(leads).where(and(eq(leads.id, id), eq(leads.organizationId, this.orgId), eq(leads.isDeleted, false), ...(user.roleNames.includes("Sales Executive") ? [eq(leads.ownerId, user.userId)] : []))).limit(1);
    if (!lead) throw new NotFoundError("Lead not found.");
    const since = new Date(Date.now() - 30 * 86400000);
    const [all, recent, mtgs, comms, saved] = await Promise.all([
      db.select({ id: activities.id }).from(activities).where(and(eq(activities.organizationId, this.orgId), eq(activities.leadId, id))).limit(100),
      db.select({ id: activities.id, at: activities.occurredAt }).from(activities).where(and(eq(activities.organizationId, this.orgId), eq(activities.leadId, id), gte(activities.occurredAt, since))).orderBy(desc(activities.occurredAt)).limit(100),
      db.select({ id: meetings.id, updatedAt: meetings.updatedAt }).from(meetings).where(and(eq(meetings.organizationId, this.orgId), eq(meetings.leadId, id))).limit(20),
      db.select({ openedAt: communications.openedAt, clickedAt: communications.clickedAt, updatedAt: communications.updatedAt }).from(communications).where(and(eq(communications.organizationId, this.orgId), eq(communications.leadId, id), gte(communications.updatedAt, since))).limit(100),
      db.select({ supportingData: aiInsights.supportingData }).from(aiInsights).where(and(eq(aiInsights.organizationId, this.orgId), eq(aiInsights.entityType, "lead"), eq(aiInsights.entityId, id), eq(aiInsights.insightType, "risk"))).orderBy(desc(aiInsights.createdAt)).limit(1),
    ]);
    const current = calculateBuyingIntent({ activity: all.length, recent: recent.length, meetings: mtgs.length, proposals: 0, engagement: comms.filter((x) => x.openedAt || x.clickedAt).length });
    const freshDates = [...recent.map((x) => x.at), ...mtgs.map((x) => x.updatedAt), ...comms.map((x) => x.updatedAt)];
    const sourceFreshAt = freshDates.length ? freshDates.reduce((a, b) => a > b ? a : b).toISOString() : "none";
    const prior = saved[0]?.supportingData as { intent?: typeof current; sourceFreshAt?: string } | null;
    const cached = prior?.sourceFreshAt === sourceFreshAt ? prior.intent : null;
    return { lead, ...(cached ?? current), sourceFreshAt, stale: Boolean(saved[0] && !cached), aiUnavailable: !aiProvider.isConfigured };
  }
  async refreshIntent(id: string, user: { userId: string; roleNames: string[] }) {
    const current = await this.intent(id, user);
    if (!current.stale && current.provenance !== "deterministic_first_party_crm") return current;
    if (current.score === null) return current;
    let explanation = current.explanation; let recommendation = current.recommendedAction; let model = current.provenance;
    if (aiProvider.isConfigured) try {
      const parsed = parseAndValidate(z.object({ explanation: z.string().min(1).max(400), recommendedAction: z.string().min(1).max(220) }), await aiProvider.generateStructured({ jsonMode: true, system: "Explain only these first-party CRM buying signals. Do not imply external intent. Return JSON explanation and recommendedAction.", user: JSON.stringify({ level: current.level, score: current.score, signals: current.signals }) }));
      explanation = parsed.explanation; recommendation = parsed.recommendedAction; model = aiProvider.model;
    } catch { model = "deterministic_provider_fallback"; }
    const intent = { ...current, explanation, recommendedAction: recommendation, provenance: model, generatedAt: new Date().toISOString() };
    await db.insert(aiInsights).values({ organizationId: this.orgId, entityType: "lead", entityId: id, insightType: "risk", result: current.level + " buying intent", score: current.score, reasons: current.signals, recommendation, supportingData: { intent, sourceFreshAt: current.sourceFreshAt }, modelVersion: model });
    return intent;
  }
  async daily(user: { userId: string; roleNames: string[] }) {
    const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const [mtgs, taskRows, followupRows, leadRows, deals, events, allRisks] = await Promise.all([
      db.select({ id: meetings.id, title: meetings.title, dueAt: meetings.scheduledAt, updatedAt: meetings.updatedAt }).from(meetings).where(and(eq(meetings.organizationId, this.orgId), gte(meetings.scheduledAt, start), lte(meetings.scheduledAt, end), ...(user.roleNames.includes("Sales Executive") ? [eq(meetings.organizerId, user.userId)] : []))).orderBy(meetings.scheduledAt).limit(30),
      db.select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueDate, updatedAt: tasks.updatedAt }).from(tasks).where(and(eq(tasks.organizationId, this.orgId), eq(tasks.assignedTo, user.userId), inArray(tasks.status, ["pending", "in_progress", "overdue"]), lte(tasks.dueDate, end))).limit(30),
      db.select({ id: followups.id, title: followups.actionDescription, dueAt: followups.scheduledAt, updatedAt: followups.updatedAt }).from(followups).where(and(eq(followups.organizationId, this.orgId), eq(followups.assignedTo, user.userId), eq(followups.status, "pending"), lte(followups.scheduledAt, end))).limit(30),
      db.select({ id: leads.id, name: leads.fullName, score: leads.aiScore, updatedAt: leads.updatedAt }).from(leads).where(and(eq(leads.organizationId, this.orgId), eq(leads.isDeleted, false), ...(user.roleNames.includes("Sales Executive") ? [eq(leads.ownerId, user.userId)] : []))).orderBy(desc(leads.aiScore)).limit(50),
      db.select({ id: opportunities.id, name: opportunities.name, amount: opportunities.amount, updatedAt: opportunities.updatedAt, expectedCloseDate: opportunities.expectedCloseDate }).from(opportunities).where(and(eq(opportunities.organizationId, this.orgId), eq(opportunities.isDeleted, false), isNull(opportunities.closedAt), ...(user.roleNames.includes("Sales Executive") ? [eq(opportunities.ownerId, user.userId)] : []))).orderBy(desc(opportunities.updatedAt)).limit(20),
      db.select({ id: activities.id, subject: activities.subject, at: activities.occurredAt }).from(activities).where(and(eq(activities.organizationId, this.orgId), eq(activities.performedBy, user.userId), gte(activities.occurredAt, start), lte(activities.occurredAt, end))).orderBy(desc(activities.occurredAt)).limit(20),
      new ForecastingService(this.orgId).dealRisks(),
    ]);
    const opportunityRisks = allRisks.risks.filter((x) => !user.roleNames.includes("Sales Executive") || x.ownerId === user.userId).filter((x) => x.riskScore >= 60).slice(0, 10);
    const recentStageRows = deals.length ? await db.select({ opportunityId: opportunityStageHistory.opportunityId, changedAt: opportunityStageHistory.changedAt, reason: opportunityStageHistory.reason }).from(opportunityStageHistory).where(and(eq(opportunityStageHistory.organizationId, this.orgId), inArray(opportunityStageHistory.opportunityId, deals.map((x) => x.id)), gte(opportunityStageHistory.changedAt, new Date(now.getTime() - 7 * 86400000)))).orderBy(desc(opportunityStageHistory.changedAt)).limit(20) : [];
    const pipelineChanges = recentStageRows.map((x) => ({ opportunityId: x.opportunityId, opportunityName: deals.find((deal) => deal.id === x.opportunityId)?.name ?? "Opportunity", changedAt: x.changedAt.toISOString(), reason: x.reason }));
    const items = [...mtgs.map((x) => ({ id: x.id, type: "meeting", title: x.title, dueAt: x.dueAt, reason: "Meeting scheduled today.", priority: "medium" })),
      ...taskRows.map((x) => ({ id: x.id, type: "task", title: x.title, dueAt: x.dueAt, reason: "Assigned task due.", priority: x.dueAt && x.dueAt < now ? "high" : "medium" })),
      ...followupRows.map((x) => ({ id: x.id, type: "followup", title: x.title ?? "Follow-up", dueAt: x.dueAt, reason: x.dueAt < now ? "Follow-up is overdue." : "Follow-up is due today.", priority: x.dueAt < now ? "high" : "medium" })),
      ...leadRows.filter((x) => (x.score ?? 0) >= 75).slice(0, 8).map((x) => ({ id: x.id, type: "lead", title: x.name, dueAt: null, reason: "Recorded lead score is " + x.score + "/100.", priority: "high" })),
      ...deals.filter((x) => x.expectedCloseDate && x.expectedCloseDate >= now && x.expectedCloseDate.getTime() <= now.getTime() + 7 * 86400000).slice(0, 5).map((x) => ({ id: x.id, type: "opportunity", title: x.name, dueAt: x.expectedCloseDate, reason: "Expected close date is within seven days.", priority: "high" })),
      ...opportunityRisks.map((x) => ({ id: x.opportunityId, type: "risk", title: x.opportunityName, dueAt: null, reason: x.reasons.join(" ") || "Existing opportunity risk score is high.", priority: "high" }))];
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, normal: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
    const day = start.toISOString().slice(0, 10);
    const freshnessDates = [...mtgs.map((x) => x.updatedAt), ...taskRows.map((x) => x.updatedAt), ...followupRows.map((x) => x.updatedAt), ...leadRows.map((x) => x.updatedAt), ...deals.map((x) => x.updatedAt), ...events.map((x) => x.at), ...recentStageRows.map((x) => x.changedAt)];
    const freshAt = freshnessDates.length ? freshnessDates.reduce((a, b) => a > b ? a : b).toISOString() : null;
    const [saved] = await db.select({ supportingData: aiInsights.supportingData, createdAt: aiInsights.createdAt }).from(aiInsights).where(and(eq(aiInsights.organizationId, this.orgId), eq(aiInsights.entityType, "user"), eq(aiInsights.entityId, user.userId), eq(aiInsights.insightType, "next_action"))).orderBy(desc(aiInsights.createdAt)).limit(1);
    const old = saved?.supportingData as { day?: string; freshAt?: string; summary?: string; recommendations?: string[] } | null;
    const brief = old?.day === day && old.freshAt === freshAt ? { summary: old.summary, recommendations: old.recommendations, generatedAt: saved?.createdAt.toISOString() } : null;
    return { day, items: items.map((x) => ({ ...x, dueAt: x.dueAt?.toISOString() ?? null })), meetings: mtgs, opportunities: deals, opportunityRisks, pipelineChanges, overdueFollowups: followupRows.filter((x) => x.dueAt < now), recentActivities: events, sourceFreshAt: freshAt, brief, briefStale: Boolean(saved && !brief), noData: !items.length && !deals.length && !events.length, aiUnavailable: !aiProvider.isConfigured };
  }
  async brief(user: { userId: string; roleNames: string[] }) {
    const d = await this.daily(user);
    if (d.noData) return { summary: "Insufficient CRM data to prepare a useful sales brief.", recommendations: [], method: "insufficient_data" };
    if (!aiProvider.isConfigured) throw new ConfigurationError("AI sales brief generation is unavailable because the AI provider is not configured.");
    const result = parseAndValidate(briefSchema, await aiProvider.generateStructured({ jsonMode: true, system: "Write a concise sales brief using only CRM records. Do not invent facts. Return JSON summary and recommendations.", user: JSON.stringify({ day: d.day, items: d.items.slice(0, 12), meetings: d.meetings, opportunities: d.opportunities, pipelineChanges: d.pipelineChanges, risks: d.opportunityRisks, overdue: d.overdueFollowups }) }));
    const [savedBrief] = await db.insert(aiInsights).values({ organizationId: this.orgId, entityType: "user", entityId: user.userId, insightType: "next_action", result: result.summary.slice(0, 255), recommendation: result.recommendations.join(" "), supportingData: { day: d.day, freshAt: d.sourceFreshAt, ...result }, modelVersion: aiProvider.model }).returning({ createdAt: aiInsights.createdAt });
    return { ...result, generatedAt: savedBrief.createdAt.toISOString(), method: aiProvider.model };
  }
  async reps(user: { userId: string; roleNames: string[] }) {
    if (!user.roleNames.some((x) => ["Admin", "Super Admin", "Sales Manager"].includes(x))) throw new ForbiddenError("Manager permission is required.");
    const since = new Date(Date.now() - 30 * 86400000);
    const reps = await db.select({ id: users.id, name: users.fullName }).from(users).where(and(eq(users.organizationId, this.orgId), eq(users.status, "active"), eq(users.isDeleted, false))).limit(150);
    const ids = reps.map((x) => x.id); if (!ids.length) return { reps: [], periodDays: 30, insufficientData: true };
    const [acts, leadsRows, deals, followRows, meetingsRows, movementRows] = await Promise.all([
      db.select({ owner: activities.performedBy }).from(activities).where(and(eq(activities.organizationId, this.orgId), gte(activities.occurredAt, since), inArray(activities.performedBy, ids))).limit(5000),
      db.select({ owner: leads.ownerId }).from(leads).where(and(eq(leads.organizationId, this.orgId), eq(leads.isDeleted, false), gte(leads.updatedAt, since), inArray(leads.ownerId, ids))).limit(5000),
      db.select({ owner: opportunities.ownerId, amount: opportunities.amount }).from(opportunities).where(and(eq(opportunities.organizationId, this.orgId), eq(opportunities.isDeleted, false), isNull(opportunities.closedAt), gte(opportunities.updatedAt, since), inArray(opportunities.ownerId, ids))).limit(5000),
      db.select({ owner: followups.assignedTo, status: followups.status }).from(followups).where(and(eq(followups.organizationId, this.orgId), gte(followups.updatedAt, since), inArray(followups.assignedTo, ids))).limit(5000),
      db.select({ owner: meetings.organizerId }).from(meetings).where(and(eq(meetings.organizationId, this.orgId), gte(meetings.scheduledAt, since), lte(meetings.scheduledAt, new Date()), inArray(meetings.organizerId, ids))).limit(5000),
      db.select({ owner: opportunityStageHistory.changedBy }).from(opportunityStageHistory).where(and(eq(opportunityStageHistory.organizationId, this.orgId), gte(opportunityStageHistory.changedAt, since), inArray(opportunityStageHistory.changedBy, ids))).limit(5000),
    ]);
    const result = { periodDays: 30, generatedAt: new Date().toISOString(), insufficientData: !acts.length && !followRows.length && !meetingsRows.length && !movementRows.length, reps: reps.map((r) => ({ id: r.id, name: r.name, metrics: { leadsHandled: leadsRows.filter((x) => x.owner === r.id).length, opportunitiesHandled: deals.filter((x) => x.owner === r.id).length, pipelineAmount: deals.filter((x) => x.owner === r.id).reduce((sum, x) => sum + (x.amount ?? 0), 0), activitiesCompleted: acts.filter((x) => x.owner === r.id).length, followupsCompleted: followRows.filter((x) => x.owner === r.id && x.status === "completed").length, meetings: meetingsRows.filter((x) => x.owner === r.id).length, opportunityMovements: movementRows.filter((x) => x.owner === r.id).length }, interpretation: null })) };
    const [saved] = await db.select({ supportingData: aiInsights.supportingData, createdAt: aiInsights.createdAt }).from(aiInsights).where(and(eq(aiInsights.organizationId, this.orgId), eq(aiInsights.entityType, "sales_rep_coaching"), eq(aiInsights.entityId, user.userId), eq(aiInsights.insightType, "next_action"))).orderBy(desc(aiInsights.createdAt)).limit(1);
    const cache = saved?.supportingData as { signature?: string; coaching?: Array<{ userId: string; insight: string }> } | null;
    const signature = JSON.stringify(result.reps.map((r) => ({ userId: r.id, metrics: r.metrics })));
    return { ...result, coaching: cache?.signature === signature ? cache.coaching ?? null : null, coachingStale: Boolean(cache && cache.signature !== signature), coachingGeneratedAt: cache?.signature === signature ? saved?.createdAt.toISOString() ?? null : null };
  }
  async coachReps(user: { userId: string; roleNames: string[] }) {
    const data = await this.reps(user);
    if (data.insufficientData || !data.reps.some((r) => r.metrics.activitiesCompleted + r.metrics.followupsCompleted + r.metrics.meetings >= 3)) return { ...data, coaching: null, insufficientData: true };
    if (!aiProvider.isConfigured) return { ...data, coaching: null, aiUnavailable: true, error: "AI coaching is unavailable because the AI provider is not configured." };
    const metrics = data.reps.map((r) => ({ userId: r.id, metrics: r.metrics }));
    const signature = JSON.stringify(metrics);
    const [prior] = await db.select({ supportingData: aiInsights.supportingData, createdAt: aiInsights.createdAt }).from(aiInsights).where(and(eq(aiInsights.organizationId, this.orgId), eq(aiInsights.entityType, "sales_rep_coaching"), eq(aiInsights.entityId, user.userId), eq(aiInsights.insightType, "next_action"))).orderBy(desc(aiInsights.createdAt)).limit(1);
    const saved = prior?.supportingData as { kind?: string; signature?: string; coaching?: Array<{ userId: string; insight: string }> } | null;
    if (saved?.kind === "sales_rep_coaching" && saved.signature === signature) return { ...data, coaching: saved.coaching, coachingGeneratedAt: prior?.createdAt.toISOString() ?? null, cached: true, aiUnavailable: false };
    let coaching: Array<{ userId: string; insight: string }>;
    try {
      const out = parseAndValidate(z.object({ coaching: z.array(z.object({ userId: z.string().uuid(), insight: z.string().min(1).max(300) })).max(150) }), await aiProvider.generateStructured({ jsonMode: true, system: "Give neutral coaching observations using only supplied CRM counts. Do not rank reps, assess personality, or make unsupported performance claims. Return JSON coaching array with userId and one concise insight.", user: JSON.stringify(metrics) }));
      const allowed = new Set(metrics.map((x) => x.userId)); coaching = out.coaching.filter((x) => allowed.has(x.userId));
    } catch { return { ...data, coaching: null, aiUnavailable: true, error: "AI coaching is unavailable." }; }
    const [savedCoaching] = await db.insert(aiInsights).values({ organizationId: this.orgId, entityType: "sales_rep_coaching", entityId: user.userId, insightType: "next_action", result: "Sales rep coaching observations", reasons: [], recommendation: "Review CRM activity patterns with context.", supportingData: { kind: "sales_rep_coaching", signature, coaching }, modelVersion: aiProvider.model }).returning({ createdAt: aiInsights.createdAt });
    return { ...data, coaching, coachingGeneratedAt: savedCoaching.createdAt.toISOString(), aiUnavailable: false };
  }
}
