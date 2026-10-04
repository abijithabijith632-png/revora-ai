"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select } from "@/components/ui";
import { formatMoney } from "@/lib/money";

interface DashboardPayload {
  leadsOverTime: Array<{ date: string; count: number }>;
  opportunitiesOverTime: Array<{ date: string; count: number; value: number }>;
  pipelineByStage: Array<{ stage: string | null; stageName: string | null; count: number; value: number }>;
  sourceAttribution: Array<{ source: string | null; count: number }>;
  leadsByStatus: Array<{ status: string | null; count: number }>;
  aiScoreDistribution: { buckets: Array<{ bucket: string; count: number }>; unscored: number };
  days: number;
}

export interface ExecRow {
  id: string;
  name: string;
  won: number;
  lost: number;
  revenue: number;
}

const DONUT_COLORS = ["#EC4899", "#DB2777", "#F472B6", "#9D174D", "#F9A8D4", "#831843", "#FBCFE8", "#BE185D"];

function useDashboard(days: number) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/analytics/dashboard?days=${days}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error?.message ?? `Analytics unavailable (${res.status}).`);
        }
        setData(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analytics unavailable.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return { data, loading, error, refreshing, reload: () => load(true) };
}

function Donut({ slices }: { slices: Array<{ label: string; count: number }> }) {
  const total = slices.reduce((a, s) => a + s.count, 0);
  let acc = 0;
  const segments = slices.map((s, i) => {
    const share = total > 0 ? (s.count / total) * 100 : 0;
    const seg = {
      ...s,
      share,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      offset: 25 - acc,
    };
    acc += share;
    return seg;
  });
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 42 42" className="h-36 w-36 shrink-0" role="img" aria-label="Lead status distribution">
        <circle cx="21" cy="21" r="15.915" fill="transparent" strokeWidth="6" className="stroke-border" />
        {segments.map((s) =>
          s.share > 0 ? (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={s.color}
              strokeWidth="6"
              strokeDasharray={`${s.share} ${100 - s.share}`}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ) : null,
        )}
        <text x="21" y="23" textAnchor="middle" className="fill-foreground text-[7px] font-semibold">
          {total}
        </text>
      </svg>
      <ul className="w-full min-w-0 space-y-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate capitalize text-muted-foreground">{s.label}</span>
            <span className="font-semibold text-foreground">
              {s.count} · {Math.round(s.share)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendLines({
  leads,
  opportunities,
  days,
}: {
  leads: Array<{ date: string; count: number }>;
  opportunities: Array<{ date: string; count: number }>;
  days: number;
}) {
  const points = useMemo(() => {
    const byDate = new Map<string, { leads: number; opps: number }>();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      byDate.set(d.toISOString().slice(0, 10), { leads: 0, opps: 0 });
    }
    for (const r of leads) {
      const e = byDate.get(r.date);
      if (e) e.leads = r.count;
    }
    for (const r of opportunities) {
      const e = byDate.get(r.date);
      if (e) e.opps = r.count;
    }
    return [...byDate.entries()];
  }, [leads, opportunities, days]);

  const max = Math.max(1, ...points.map(([, v]) => Math.max(v.leads, v.opps)));
  const W = 600;
  const H = 200;
  const PAD = 8;
  const x = (i: number) => (points.length <= 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2));
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = (pick: (v: { leads: number; opps: number }) => number) =>
    points.map(([, v], i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(v)).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Lead and opportunity trend">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} className="stroke-border" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        <path d={line((v) => v.leads)} fill="none" stroke="#EC4899" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={line((v) => v.opps)} fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[#EC4899]" /> Leads
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[#64748B]" /> Opportunities
        </span>
        <span className="ml-auto">
          {points[0]?.[0]} → {points[points.length - 1]?.[0]}
        </span>
      </div>
    </div>
  );
}

function BarList({
  rows,
  format,
}: {
  rows: Array<{ label: string; value: number; hint?: string }>;
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate capitalize text-muted-foreground">{r.label}</span>
            <span className="shrink-0 font-semibold text-foreground">
              {format(r.value)}
              {r.hint ? <span className="font-normal text-muted-foreground"> · {r.hint}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-subtle">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Real CRM-data charts: status donut, lead/opportunity trend, pipeline value
 * by stage, source analysis, executive performance, and AI score
 * distribution. Dependency-free SVG/bars that re-render from live API data.
 */
export function AnalyticsCharts({ execRows }: { execRows: ExecRow[] }) {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const { data, loading, error, refreshing, reload } = useDashboard(days);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-range" className="text-sm text-muted-foreground">
            Date range
          </label>
          <Select
            id="analytics-range"
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-36"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { void reload(); router.refresh(); }}
          loading={refreshing}
          disabled={refreshing || loading}
          className="sm:ml-auto"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading charts…
        </p>
      ) : error || !data ? (
        <div className="space-y-2 rounded-lg border border-border p-6 text-center">
          <p role="alert" className="text-sm text-danger">
            {error || "Charts unavailable."}
          </p>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead status distribution</CardTitle>
                <CardDescription>Live lead counts by status.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.leadsByStatus.length === 0 ? (
                  <EmptyState label="No leads yet." />
                ) : (
                  <Donut
                    slices={data.leadsByStatus.map((s) => ({
                      label: s.status ?? "Unknown",
                      count: s.count,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead & opportunity trend</CardTitle>
                <CardDescription>
                  New records per day · last {data.days} days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.leadsOverTime.length === 0 && data.opportunitiesOverTime.length === 0 ? (
                  <EmptyState label="No leads or opportunities in this date range." />
                ) : (
                  <TrendLines
                    leads={data.leadsOverTime}
                    opportunities={data.opportunitiesOverTime}
                    days={data.days}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline value by stage</CardTitle>
                <CardDescription>Open value per pipeline stage.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.pipelineByStage.length === 0 || data.pipelineByStage.every((s) => s.count === 0) ? (
                  <EmptyState label="No open opportunities in the pipeline." />
                ) : (
                  <BarList
                    rows={data.pipelineByStage.map((s) => ({
                      label: s.stageName ?? s.stage ?? "Unknown",
                      value: s.value,
                      hint: `${s.count} deals`,
                    }))}
                    format={(v) => formatMoney(v)}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead source analysis</CardTitle>
                <CardDescription>Lead volume by source channel.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.sourceAttribution.length === 0 ? (
                  <EmptyState label="No lead sources recorded." />
                ) : (
                  <BarList
                    rows={data.sourceAttribution.map((s) => ({
                      label: (s.source ?? "Unknown").replace(/_/g, " "),
                      value: s.count,
                    }))}
                    format={(v) => String(v)}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sales executive performance</CardTitle>
                <CardDescription>Won / lost / revenue per executive.</CardDescription>
              </CardHeader>
              <CardContent>
                {execRows.length === 0 ? (
                  <EmptyState label="No executive data." />
                ) : (
                  <BarList
                    rows={execRows.map((e) => ({
                      label: e.name,
                      value: e.revenue,
                      hint: `${e.won} won · ${e.lost} lost`,
                    }))}
                    format={(v) => formatMoney(v)}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI lead score distribution</CardTitle>
                <CardDescription>
                  Scored leads by bucket
                  {data.aiScoreDistribution.unscored > 0 &&
                    ` · ${data.aiScoreDistribution.unscored} unscored`}
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.aiScoreDistribution.buckets.every((b) => b.count === 0) ? (
                  <EmptyState label="No leads have an AI score yet." />
                ) : <BarList
                  rows={data.aiScoreDistribution.buckets.map((b) => ({
                    label: b.bucket,
                    value: b.count,
                  }))}
                  format={(v) => String(v)}
                />}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}
