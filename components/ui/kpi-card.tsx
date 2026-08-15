import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { InfoTip } from "./tooltip";
import { Skeleton } from "./skeleton";

/**
 * KPI card — reusable metric card with title, value, trend, comparison,
 * icon, status, and contextual explanation (tooltip).
 */
export interface KpiCardProps {
  title: string;
  value: string;
  /** +12.4% / -3.1% */
  trend?: number;
  /** "vs previous period" */
  comparison?: string;
  icon?: ReactNode;
  explanation?: string;
  tone?: "default" | "success" | "warning" | "danger";
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  trend,
  comparison,
  icon,
  explanation,
  tone = "default",
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const trendPositive = (trend ?? 0) >= 0;
  const TrendIcon = trendPositive ? TrendingUp : TrendingDown;

  const valueTone = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{title}</p>
            {explanation && <InfoTip content={explanation} />}
          </div>
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-subtle text-muted-foreground">
              {icon}
            </span>
          )}
        </div>

        <p className={cn("mt-2 text-2xl font-semibold tabular-nums", valueTone)}>
          {value}
        </p>

        {(trend !== undefined || comparison) && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {trend !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trendPositive ? "text-success" : "text-danger",
                )}
              >
                <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {trendPositive ? "+" : ""}
                {trend.toFixed(1)}%
              </span>
            )}
            {comparison && (
              <span className="text-faint">{comparison}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
