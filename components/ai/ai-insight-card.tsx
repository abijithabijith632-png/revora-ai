"use client";

import { type ReactNode } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/tooltip";
import { AiOrb } from "./ai-orb";

/**
 * AI UI system — explainable insight cards, confidence visualization,
 * and processing states. These are presentation-only components for future
 * AI services (no real AI logic).
 */

/* -------------------------------------------------------------
 * Confidence ring + label
 * ------------------------------------------------------------ */
export function AiConfidence({
  value,
  label,
  size = "md",
}: {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: 40, md: 56, lg: 72 }[size];
  const stroke = { sm: 4, md: 5, lg: 6 }[size];
  const radius = (dims - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const tone =
    value >= 70 ? "text-success" : value >= 40 ? "text-warning" : "text-danger";
  const ring =
    value >= 70 ? "stroke-success" : value >= 40 ? "stroke-warning" : "stroke-danger";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center">
        <svg width={dims} height={dims} className="-rotate-90">
          <circle
            cx={dims / 2}
            cy={dims / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-surface-hover"
          />
          <circle
            cx={dims / 2}
            cy={dims / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-all duration-slow ease-out", ring)}
          />
        </svg>
        <span
          className={cn(
            "absolute font-semibold tabular-nums",
            size === "sm" && "text-[10px]",
            size === "md" && "text-xs",
            size === "lg" && "text-sm",
            tone,
          )}
        >
          {value}%
        </span>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

/* -------------------------------------------------------------
 * Explainable insight card
 * ------------------------------------------------------------ */
export interface AiInsightProps {
  title: string;
  result: string;
  score?: number;
  confidence?: number;
  reasons?: string[];
  positiveSignals?: string[];
  riskSignals?: string[];
  recommendation?: string;
  actions?: ReactNode;
}

export function AiInsightCard({
  title,
  result,
  score,
  confidence,
  reasons = [],
  positiveSignals = [],
  riskSignals = [],
  recommendation,
  actions,
}: AiInsightProps) {
  return (
    <Card className="border-ai/30 bg-ai-bg/40">
      <CardHeader className="flex-row items-center gap-2 pb-3">
        <Sparkles className="h-4 w-4 text-ai" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wider text-ai">
          {title}
        </span>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-foreground">{result}</p>
            {score !== undefined && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Score: {score} / 100
              </p>
            )}
          </div>
          {confidence !== undefined && (
            <AiConfidence value={confidence} label="Confidence" />
          )}
        </div>

        {reasons.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Why this result? <InfoTip content="Explainable AI reasoning for this prediction." />
            </p>
            <ul className="space-y-1">
              {reasons.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ai" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(positiveSignals.length > 0 || riskSignals.length > 0) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {positiveSignals.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-success">
                  Positive signals
                </p>
                <ul className="space-y-1">
                  {positiveSignals.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {riskSignals.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-danger">
                  Risk signals
                </p>
                <ul className="space-y-1">
                  {riskSignals.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {recommendation && (
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Recommended action
            </p>
            <p className="mt-1 text-sm text-foreground">{recommendation}</p>
          </div>
        )}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------
 * AI processing state
 * ------------------------------------------------------------ */
export function AiProcessing({
  label = "Analyzing lead signals...",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-ai/30 bg-ai-bg/40 p-8"
      role="status"
      aria-live="polite"
    >
      <AiOrb className="scale-75" label={label} />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-ai" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
 * AI ready state (post-processing)
 * ------------------------------------------------------------ */
export function AiReady({
  label = "AI insight ready",
  onView,
}: {
  label?: string;
  onView?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success-bg/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      {onView && (
        <Button variant="ghost" size="sm" onClick={onView}>
          View <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
