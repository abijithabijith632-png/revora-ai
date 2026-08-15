import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  Users,
  Target,
  IndianRupee,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  GitPullRequestArrow,
} from "lucide-react";
import {
  PageHeader,
  KpiCard,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  EmptyState,
} from "@/components/ui";
import { AiInsightCard } from "@/components/ai";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { AnalyticsService } from "@/server/services/analytics";
import { ForecastingService } from "@/server/services/forecasting";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

/**
 * Production dashboard — real PostgreSQL-backed metrics, tenant-scoped and
 * RBAC-gated. Reuses the Phase 15 AnalyticsService + ForecastingService and the
 * existing explainable AI insight data (never fabricated).
 */
export default async function DashboardPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "dashboard.view",
  );
  if (!allowed) redirect("/forbidden");

  const analytics = new AnalyticsService(session.organizationId);
  const forecasting = new ForecastingService(session.organizationId);

  const [dashboard, funnel, forecast, latestAi] = await Promise.all([
    analytics.dashboard(),
    analytics.funnel(),
    forecasting.revenueForecast(),
    db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.organizationId, session.organizationId))
      .orderBy(desc(aiInsights.createdAt))
      .limit(1),
  ]);

  const won = dashboard.wonDeals;
  const lost = dashboard.lostDeals;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0;

  const ai = latestAi[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live sales intelligence from your organization's data."
        actions={
          <Badge variant="success" dot>
            Live · Tenant-scoped
          </Badge>
        }
      />

      {/* KPI cards — real aggregations */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Leads"
            value={String(dashboard.totalLeads)}
            icon={<Users className="h-4 w-4" />}
            explanation="Total active leads in your organization."
          />
          <KpiCard
            title="Active Opportunities"
            value={String(dashboard.activeOpportunities)}
            icon={<Target className="h-4 w-4" />}
            explanation="Open opportunities in active (non-terminal) pipeline stages."
          />
          <KpiCard
            title="Pipeline Value"
            value={formatMoney(dashboard.totalPipelineValue)}
            icon={<IndianRupee className="h-4 w-4" />}
            explanation="Total amount of open opportunities."
          />
          <KpiCard
            title="Win Rate"
            value={`${winRate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            explanation="Won deals divided by (won + lost) deals."
            tone={winRate >= 50 ? "success" : winRate >= 25 ? "warning" : "danger"}
          />
        </div>
      </section>

      <section aria-label="Secondary metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="New Leads" value={String(dashboard.newLeads)} />
        <KpiCard title="Qualified Leads" value={String(dashboard.qualifiedLeads)} />
        <KpiCard title="Won Deals" value={String(dashboard.wonDeals)} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard title="Lost Deals" value={String(dashboard.lostDeals)} icon={<XCircle className="h-4 w-4" />} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Real explainable AI insight (latest tenant-scoped) */}
          {ai ? (
            <AiInsightCard
              title="Latest AI Insight"
              result={ai.result}
              score={ai.score ?? undefined}
              confidence={ai.confidence ?? undefined}
              reasons={ai.reasons ?? []}
              positiveSignals={ai.positiveSignals ?? []}
              riskSignals={ai.riskSignals ?? []}
              recommendation={ai.recommendation ?? undefined}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  title="No AI insights yet"
                  description="Score a lead or predict a deal to surface explainable AI intelligence here."
                  icon={<Sparkles className="h-5 w-5" />}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Sales funnel</CardTitle>
              <CardDescription>
                Lead → Contacted → Qualified → Proposal → Negotiation → Won.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {funnel.stages.map((s) => (
                <div key={s.stage} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{s.stage}</span>
                  <span className="font-semibold text-foreground">{s.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitPullRequestArrow className="h-4 w-4 text-muted-foreground" />
                Revenue Forecast
              </CardTitle>
              <CardDescription>{forecast.explanation}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {forecast.monthly.map((m) => (
                <div key={m.month} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{m.month}</span>
                  <span className="font-semibold text-foreground">
                    {formatMoney(m.expectedRevenue)}
                  </span>
                </div>
              ))}
              <p className="pt-2 text-xs text-faint">
                Method: {forecast.method} · AI configured: {forecast.providerConfigured ? "Yes" : "No"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Won Revenue</CardTitle>
              <CardDescription>Confirmed revenue from won deals.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-success">
                {formatMoney(dashboard.totalRevenue)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
