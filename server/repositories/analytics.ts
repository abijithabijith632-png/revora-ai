import { and, eq, sql } from "drizzle-orm";
import { TenantRepository } from "./base";
import {
  leads,
  opportunities,
  pipelineStages,
  tasks,
  followups,
} from "@/db/schema";

/**
 * Analytics repository — real PostgreSQL aggregations for the executive
 * dashboard, funnel, performance, and forecasting. No fabricated metrics.
 */
export class AnalyticsRepository extends TenantRepository {
  private leadWhere() {
    return and(
      eq(leads.organizationId, this.organizationId),
      eq(leads.isDeleted, false),
    )!;
  }

  private oppWhere() {
    return and(
      eq(opportunities.organizationId, this.organizationId),
      eq(opportunities.isDeleted, false),
    )!;
  }

  async dashboard() {
    const [leadStats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        newLeads: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
        qualified: sql<number>`count(*) filter (where ${leads.qualificationStatus} = 'qualified')::int`,
      })
      .from(leads)
      .where(this.leadWhere());

    const [oppStats] = await this.db
      .select({
        active: sql<number>`count(*) filter (where ${pipelineStages}.key not in ('won','lost'))::int`,
        won: sql<number>`count(*) filter (where ${pipelineStages}.key = 'won')::int`,
        lost: sql<number>`count(*) filter (where ${pipelineStages}.key = 'lost')::int`,
        pipelineValue: sql<number>`coalesce(sum(${opportunities.amount}), 0)::int`,
        weightedValue: sql<number>`coalesce(sum(${opportunities.amount} * ${opportunities.probability} / 100.0), 0)::numeric`,
        wonValue: sql<number>`coalesce(sum(${opportunities.amount}) filter (where ${pipelineStages}.key = 'won'), 0)::int`,
      })
      .from(opportunities)
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(this.oppWhere());

    const totalLeads = leadStats?.total ?? 0;
    const conversionRate =
      totalLeads > 0 ? ((leadStats?.qualified ?? 0) / totalLeads) * 100 : 0;

    return {
      totalLeads,
      newLeads: leadStats?.newLeads ?? 0,
      qualifiedLeads: leadStats?.qualified ?? 0,
      activeOpportunities: oppStats?.active ?? 0,
      wonDeals: oppStats?.won ?? 0,
      lostDeals: oppStats?.lost ?? 0,
      totalPipelineValue: oppStats?.pipelineValue ?? 0,
      totalRevenue: oppStats?.wonValue ?? 0,
      weightedPipelineValue: Number(oppStats?.weightedValue ?? 0),
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  async leadsOverTime(days = 30) {
    return this.db
      .select({
        date: sql<string>`to_char(${leads.createdAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(
        and(
          this.leadWhere(),
          sql`${leads.createdAt} >= now() - (${days} || ' days')::interval`,
        ),
      )
      .groupBy(sql`to_char(${leads.createdAt}::date, 'YYYY-MM-DD')`)
      .orderBy(sql`1`);
  }

  async funnel() {
    const stages = ["lead", "contacted", "qualified", "proposal", "negotiation", "won"];
    const [leadCounts] = await this.db
      .select({
        contacted: sql<number>`count(*) filter (where ${leads.status} in ('contacted','qualified','converted'))::int`,
        qualified: sql<number>`count(*) filter (where ${leads.status} in ('qualified','converted'))::int`,
      })
      .from(leads)
      .where(this.leadWhere());

    const [oppCounts] = await this.db
      .select({
        proposal: sql<number>`count(*) filter (where ${pipelineStages}.key in ('proposal','negotiation','final_review','won'))::int`,
        negotiation: sql<number>`count(*) filter (where ${pipelineStages}.key in ('negotiation','final_review','won'))::int`,
        won: sql<number>`count(*) filter (where ${pipelineStages}.key = 'won')::int`,
      })
      .from(opportunities)
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(this.oppWhere());

    const totalLeads = leadStatsTotal(await this.leadCount());

    return {
      stages: stages.map((s) => {
        let count = 0;
        if (s === "lead") count = totalLeads;
        if (s === "contacted") count = leadCounts?.contacted ?? 0;
        if (s === "qualified") count = leadCounts?.qualified ?? 0;
        if (s === "proposal") count = oppCounts?.proposal ?? 0;
        if (s === "negotiation") count = oppCounts?.negotiation ?? 0;
        if (s === "won") count = oppCounts?.won ?? 0;
        return { stage: s, count };
      }),
    };
  }

  private async leadCount(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(this.leadWhere());
    return row?.count ?? 0;
  }

  async sourceAttribution() {
    return this.db
      .select({
        source: leads.source,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(this.leadWhere())
      .groupBy(leads.source)
      .orderBy(sql`2 desc`);
  }

  async pipelineByStage() {
    return this.db
      .select({
        stage: pipelineStages.key,
        stageName: pipelineStages.name,
        count: sql<number>`count(${opportunities.id})::int`,
        value: sql<number>`coalesce(sum(${opportunities.amount}), 0)::int`,
      })
      .from(pipelineStages)
      .leftJoin(
        opportunities,
        and(
          eq(opportunities.stageId, pipelineStages.id),
          eq(opportunities.organizationId, this.organizationId),
          eq(opportunities.isDeleted, false),
        ),
      )
      .where(eq(pipelineStages.organizationId, this.organizationId))
      .groupBy(pipelineStages.key, pipelineStages.name, pipelineStages.orderIndex)
      .orderBy(pipelineStages.orderIndex);
  }

  async salespersonPerformance(ownerId?: string) {
    const oppWhere = ownerId
      ? and(this.oppWhere(), eq(opportunities.ownerId, ownerId))!
      : this.oppWhere();

    const [oppStats] = await this.db
      .select({
        won: sql<number>`count(*) filter (where ${pipelineStages}.key = 'won')::int`,
        lost: sql<number>`count(*) filter (where ${pipelineStages}.key = 'lost')::int`,
        revenue: sql<number>`coalesce(sum(${opportunities.amount}) filter (where ${pipelineStages}.key = 'won'), 0)::int`,
        avgDeal: sql<number>`coalesce(avg(${opportunities.amount}) filter (where ${pipelineStages}.key = 'won'), 0)::numeric`,
      })
      .from(opportunities)
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(oppWhere);

    const [taskStats] = await this.db
      .select({
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(
        ownerId
          ? and(eq(tasks.organizationId, this.organizationId), eq(tasks.assignedTo, ownerId))!
          : eq(tasks.organizationId, this.organizationId),
      );

    const [followupStats] = await this.db
      .select({
        completed: sql<number>`count(*) filter (where ${followups.status} = 'completed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(followups)
      .where(
        ownerId
          ? and(eq(followups.organizationId, this.organizationId), eq(followups.assignedTo, ownerId))!
          : eq(followups.organizationId, this.organizationId),
      );

    const won = oppStats?.won ?? 0;
    const lost = oppStats?.lost ?? 0;
    const wonLostRatio = lost > 0 ? won / lost : won > 0 ? won : 0;
    const taskTotal = taskStats?.total ?? 0;
    const taskCompliance = taskTotal > 0 ? ((taskStats?.completed ?? 0) / taskTotal) * 100 : 0;
    const fupTotal = followupStats?.total ?? 0;
    const fupCompliance = fupTotal > 0 ? ((followupStats?.completed ?? 0) / fupTotal) * 100 : 0;

    return {
      won,
      lost,
      wonLostRatio: Math.round(wonLostRatio * 100) / 100,
      revenue: oppStats?.revenue ?? 0,
      avgDealSize: Number(oppStats?.avgDeal ?? 0),
      taskSlaCompliance: Math.round(taskCompliance * 100) / 100,
      followupSlaCompliance: Math.round(fupCompliance * 100) / 100,
    };
  }
}

function leadStatsTotal(count: number): number {
  return count;
}
