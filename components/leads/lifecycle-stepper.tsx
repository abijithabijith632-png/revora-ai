"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LIFECYCLE_ORDER,
  ALTERNATIVE_STATES,
  LIFECYCLE_STATES,
} from "@/lib/leads/lifecycle";
import type { LeadStatus } from "@/lib/leads/schemas";

/**
 * Lifecycle visualization — current stage prominent, completed stages
 * distinguishable, future/locked stages muted.
 */
export function LifecycleStepper({ current }: { current: string }) {
  const currentIdx = LIFECYCLE_ORDER.indexOf(current as LeadStatus);
  const isAlternative = ALTERNATIVE_STATES.includes(current as LeadStatus);

  return (
    <div className="space-y-4">
      <ol className="flex items-center">
        {LIFECYCLE_ORDER.map((status, i) => {
          const state = LIFECYCLE_STATES[status];
          const isCurrent = status === current;
          const isComplete = currentIdx >= 0 && i < currentIdx;

          return (
            <li key={status} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    isCurrent && "border-brand-600 bg-brand-600 text-white",
                    isComplete && "border-brand-600 bg-brand-50 text-brand-700",
                    !isCurrent && !isComplete && "border-border bg-surface text-faint",
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {state.label}
                </span>
              </div>
              {i < LIFECYCLE_ORDER.length - 1 && (
                <span
                  className={cn(
                    "mx-2 h-px flex-1",
                    i < currentIdx ? "bg-brand-600" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {isAlternative && (
        <div className="rounded-md border border-border bg-surface-subtle px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {LIFECYCLE_STATES[current as LeadStatus].label}
          </p>
          <p className="text-xs text-muted-foreground">
            {LIFECYCLE_STATES[current as LeadStatus].description}
          </p>
        </div>
      )}
    </div>
  );
}
