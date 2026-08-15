"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import { scoreToLabel } from "@/server/ai/score-schema";

interface ScoreReason {
  factor: string;
  label: string;
  impact: "positive" | "neutral" | "negative";
  explanation: string;
  evidence?: string;
}

interface ScoreRecord {
  id: string;
  score: number | null;
  result: string | null;
  confidence: number | null;
  reasons: string[];
  positiveSignals: string[];
  riskSignals: string[];
  recommendation: string | null;
  supportingData: {
    factors?: ScoreReason[];
    dataQuality?: number;
  } | null;
  modelVersion: string | null;
  createdAt: string;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const tone =
    score >= 80 ? "text-success" : score >= 60 ? "text-info" : score >= 30 ? "text-warning" : "text-danger";
  const ring =
    score >= 80 ? "stroke-success" : score >= 60 ? "stroke-info" : score >= 30 ? "stroke-warning" : "stroke-danger";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={110} height={110} className="-rotate-90">
        <circle cx={55} cy={55} r={radius} fill="none" strokeWidth={9} className="stroke-surface-hover" />
        <circle
          cx={55}
          cy={55}
          r={radius}
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-slow ease-out ${ring}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold tabular-nums ${tone}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function AiScoreCard({
  leadId,
  latest,
}: {
  leadId: string;
  latest: ScoreRecord | null;
  history?: ScoreRecord[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<ScoreRecord | null>(latest);

  async function rescore() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-score`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json?.error?.message ?? "Failed");
      setCurrent(json.data?.latest ?? null);
      toast({ variant: "success", title: "AI score recalculated." });
    } catch (err) {
      toast({
        variant: "error",
        title: "AI scoring unavailable",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  if (!current) {
    return (
      <Card className="border-ai/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ai">
            <Sparkles className="h-4 w-4" /> AI Lead Score
          </CardTitle>
          <CardDescription>AI-generated lead intelligence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Not scored yet.</p>
          <Can permission="leads.edit">
            <Button size="sm" onClick={rescore} loading={busy}>
              <RefreshCw className="h-4 w-4" />
              Generate AI Score
            </Button>
          </Can>
        </CardContent>
      </Card>
    );
  }

  const score = current.score ?? 0;
  const factors = current.supportingData?.factors ?? [];
  const positives = factors.filter((f) => f.impact === "positive");
  const risks = factors.filter((f) => f.impact === "negative");

  return (
    <Card className="border-ai/30 bg-ai-bg/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ai">
          <Sparkles className="h-4 w-4" /> AI Lead Score
        </CardTitle>
        <CardDescription>
          Generated {new Date(current.createdAt).toLocaleString()} · Model {current.modelVersion ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
          <ScoreRing score={score} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xl font-semibold capitalize text-foreground">
              {current.result?.toLowerCase().replace("_", " ") ?? scoreToLabel(score)}
            </p>
            {current.confidence != null && (
              <p className="mt-1 text-sm text-muted-foreground">
                Model confidence: {current.confidence}%
              </p>
            )}
            {current.supportingData?.dataQuality != null && (
              <p className="text-sm text-muted-foreground">
                Data quality: {current.supportingData.dataQuality}%
              </p>
            )}
            <Can permission="leads.edit">
              <Button size="sm" variant="outline" className="mt-3" onClick={rescore} loading={busy}>
                <RefreshCw className="h-4 w-4" />
                Recalculate
              </Button>
            </Can>
          </div>
        </div>

        {positives.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-success">Top drivers</p>
            <ul className="space-y-1">
              {positives.slice(0, 4).map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{f.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {risks.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-warning">Risk signals</p>
            <ul className="space-y-1">
              {risks.slice(0, 4).map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>{f.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {current.recommendation && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">AI summary</p>
            <p className="text-sm text-foreground">{current.recommendation}</p>
          </div>
        )}

        {factors.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-sm font-medium text-ai hover:underline"
            >
              Why this score?
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="mt-2 space-y-2">
                {factors.map((f) => (
                  <div key={f.label} className="rounded-md border border-border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.label}</span>
                      <span
                        className={`text-xs ${
                          f.impact === "positive"
                            ? "text-success"
                            : f.impact === "negative"
                              ? "text-danger"
                              : "text-muted-foreground"
                        }`}
                      >
                        {f.impact}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.explanation}</p>
                    {f.evidence && <p className="mt-0.5 text-xs text-faint">Source: {f.evidence}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-faint">
          AI-generated insight. Review the underlying customer information before making business decisions.
        </p>
      </CardContent>
    </Card>
  );
}
