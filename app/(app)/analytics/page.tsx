import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription, KpiCard, Badge } from "@/components/ui";
import { AnalyticsService } from "@/server/services/analytics";
import { ForecastingService } from "@/server/services/forecasting";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await requireSession();
  const analytics = new AnalyticsService(session.organizationId);
  const forecasting = new ForecastingService(session.organizationId);

  const [dashboard, funnel, sourceAttribution, pipelineByStage, forecast, risk] =
    await Promise.all([
      analytics.dashboard(),
      analytics.funnel(),
      analytics.sourceAttribution(),
      analytics.pipelineByStage(),
      forecasting.revenueForecast(),
      forecasting.churnRisk(),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Executive dashboard, funnel, forecasting, and risk."
      />

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
              Method: {forecast.method} · Provider configured:{" "}
              {forecast.providerConfigured ? "Yes" : "No"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Churn / risk early warning</CardTitle>
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
    </div>
  );
}
