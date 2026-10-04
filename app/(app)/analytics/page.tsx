import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { listOrgUsers } from "@/lib/permissions/rbac-service";
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription, KpiCard, Badge } from "@/components/ui";
import { AnalyticsService } from "@/server/services/analytics";
import { ForecastingService } from "@/server/services/forecasting";
import { formatMoney } from "@/lib/money";
import { GenerateAiAlertsButton } from "@/components/analytics/generate-ai-alerts-button";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "analytics.view",
  );
  if (!allowed) redirect("/forbidden");

  const analytics = new AnalyticsService(session.organizationId);
  const forecasting = new ForecastingService(session.organizationId);

  const [dashboard, funnel, sourceAttribution, pipelineByStage, forecast, risk, pipelineInsights] =
    await Promise.all([
      analytics.dashboard(),
      analytics.funnel(),
      analytics.sourceAttribution(),
      analytics.pipelineByStage(),
      forecasting.revenueForecast(),
      forecasting.churnRisk(),
      forecasting.pipelineIntelligence(),
    ]);

  // Executive performance rows: Sales Executives see only themselves, matching
  // the /api/analytics/performance scoping; others see the whole team.
  const isExecutive =
    session.roleNames.includes("Sales Executive") &&
    !session.roleNames.includes("Admin") &&
    !session.roleNames.includes("Super Admin") &&
    !session.roleNames.includes("Sales Manager");
  const team = isExecutive
    ? [{ id: session.userId, fullName: session.fullName }]
    : (await listOrgUsers(session.organizationId))
        .filter((user) => user.status === "active" && user.roles.some((role) => role.name === "Sales Executive"));
  const execRows = await Promise.all(
    team.map(async (u) => {
      const perf = await analytics.performance(u.id);
      return {
        id: u.id,
        name: u.fullName,
        won: perf.won,
        lost: perf.lost,
        revenue: perf.revenue,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Executive dashboard, funnel, forecasting, and risk."
      />

      <AnalyticsCharts execRows={execRows} />

      <section aria-label="KPIs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Leads" value={String(dashboard.totalLeads)} />
        <KpiCard title="Qualified Leads" value={String(dashboard.qualifiedLeads)} />
        <KpiCard title="Active Opportunities" value={String(dashboard.activeOpportunities)} />
        <KpiCard title="Pipeline Value" value={formatMoney(dashboard.totalPipelineValue)} />
        <KpiCard title="Won Deals" value={String(dashboard.wonDeals)} />
        <KpiCard title="Lost Deals" value={String(dashboard.lostDeals)} />
        <KpiCard title="Won Revenue" value={formatMoney(dashboard.totalRevenue)} />
        <KpiCard title="Conversion Rate" value={`${dashboard.conversionRate}%`} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales funnel</CardTitle>
            <CardDescription>Lead → Contacted → Qualified → Proposal → Negotiation → Won.</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
            <CardDescription>Open deals and value per stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipelineByStage.map((s) => (
              <div key={s.stage} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.stageName}</span>
                <span className="font-semibold text-foreground">
                  {s.count} · {formatMoney(s.value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source attribution</CardTitle>
            <CardDescription>Lead sources by volume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sourceAttribution.map((s) => (
              <div key={s.source} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.source}</span>
                <span className="font-semibold text-foreground">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue forecast</CardTitle>
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
            <p className="text-xs text-faint">
              Method: {forecast.methodLabel} · Confidence: unavailable (not calibrated)
            </p>
            <p className="text-xs text-muted-foreground">Won revenue {formatMoney(forecast.wonRevenue)} · Pipeline {formatMoney(forecast.pipelineValue)} · Weighted pipeline {formatMoney(forecast.weightedPipelineValue)}</p>
            <p className="text-xs text-faint">Estimate only; not guaranteed revenue.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client inactivity risk</CardTitle>
          <CardDescription>{risk.explanation}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {risk.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No at-risk clients detected.</p>
          ) : (
            risk.risks.map((r) => (
              <div key={r.clientId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.clientName}</span>
                <Badge
                  variant={
                    r.riskLevel === "Critical" || r.riskLevel === "High"
                      ? "danger"
                      : r.riskLevel === "Medium"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {r.riskLevel} · {r.daysInactive}d inactive
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle>Opportunity risk & pipeline intelligence</CardTitle><CardDescription>Signals from recorded activity, stage changes, tasks, follow-ups, and close dates.</CardDescription></div>
          <GenerateAiAlertsButton />
        </CardHeader>
        <CardContent className="space-y-3">
          {pipelineInsights.stalledOpportunities.slice(0, 10).map((r) => <div key={r.opportunityId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm">
            <span className="font-medium">{r.opportunityName}{r.stage ? ` · ${r.stage}` : ""}</span><Badge variant={r.riskScore >= 60 ? "danger" : r.riskScore >= 30 ? "warning" : "neutral"}>{r.riskLevel} risk · {r.riskScore}</Badge><span className="w-full text-muted-foreground">{r.reasons.join(" ") || "No recorded risk signals."}</span>
          </div>)}
          {pipelineInsights.stalledOpportunities.length === 0 && <p className="text-sm text-muted-foreground">No recorded opportunity risk signals.</p>}
          {pipelineInsights.bottleneck && <p className="text-sm text-muted-foreground">Largest stage by deal count: {pipelineInsights.bottleneck.stage} ({pipelineInsights.bottleneck.opportunityCount} deals).</p>}
          {pipelineInsights.highValueOpportunities.length > 0 && <div><p className="text-sm font-medium">Highest-value open opportunities</p>{pipelineInsights.highValueOpportunities.slice(0, 3).map((item) => <p key={item.opportunityId} className="text-sm"><Link className="text-brand-600 hover:underline" href={`/opportunities/${item.opportunityId}`}>{item.opportunityName}</Link> · {formatMoney(item.amount)}</p>)}</div>}
          {pipelineInsights.recentPipelineChanges.length > 0 && <div><p className="text-sm font-medium">Recent stage probability changes (7 days)</p>{pipelineInsights.recentPipelineChanges.slice(0, 3).map((change, index) => <p key={`${change.opportunityId}-${index}`} className="text-sm text-muted-foreground"><Link className="text-brand-600 hover:underline" href={change.opportunityUrl}>{change.opportunityName}</Link> · {change.previousProbability ?? "—"}% → {change.newProbability ?? "—"}%</p>)}</div>}
          <p className="text-xs text-faint">Method: {pipelineInsights.method}. Scores are review signals, not guaranteed predictions.</p>
        </CardContent>
      </Card>
    </div>
  );
}
