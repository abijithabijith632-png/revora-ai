"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import { Can } from "@/components/auth/can";
import { QualificationForm } from "./qualification-form";
import {
  QUALIFICATION_CRITERIA,
  OUTCOME_LABELS,
  OUTCOME_DESCRIPTIONS,
} from "@/lib/leads/qualification";
import type { LeadQualificationState, QualificationAssessment } from "@/lib/leads/types";

function assessmentValue(criterionKey: string, a: QualificationAssessment): string {
  const map: Record<string, string> = {
    requirementClarity: a.requirementClarity,
    budgetAvailability: a.budgetAvailability,
    purchaseTimeline: a.purchaseTimeline,
    decisionMaker: a.decisionMaker,
    companyScale: a.companyScale,
    productFit: a.productFit,
    conversionProbability: a.conversionProbability,
  };
  return map[criterionKey] ?? "";
}

function criterionLabel(criterionKey: string, value: string): string {
  const criterion = QUALIFICATION_CRITERIA.find((c) => c.key === criterionKey);
  return criterion?.valueLabels[value] ?? value;
}

/**
 * Qualification display card + empty/start flow + history.
 */
export function LeadQualification({
  leadId,
  state,
}: {
  leadId: string;
  state: LeadQualificationState;
}) {
  const [showForm, setShowForm] = useState(false);
  const latest = state.latest;

  const outcomeVariant =
    state.outcome === "qualified"
      ? "success"
      : state.outcome === "partially_qualified"
        ? "warning"
        : state.outcome === "unqualified"
          ? "danger"
          : "neutral";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Lead Qualification</CardTitle>
            <CardDescription>
              {OUTCOME_DESCRIPTIONS[state.outcome as keyof typeof OUTCOME_DESCRIPTIONS] ??
                "Complete the qualification assessment to determine sales readiness."}
            </CardDescription>
          </div>
          <Badge variant={outcomeVariant}>
            {OUTCOME_LABELS[state.outcome as keyof typeof OUTCOME_LABELS] ?? state.outcome}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!latest && !showForm && (
          <div className="rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">Lead not yet qualified</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete the qualification assessment to determine sales readiness.
            </p>
            <Can permission="leads.edit">
              <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Start Qualification
              </Button>
            </Can>
          </div>
        )}

        {showForm && (
          <div className="rounded-md border border-border p-4">
            <QualificationForm leadId={leadId} />
          </div>
        )}

        {latest && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {QUALIFICATION_CRITERIA.map((criterion) => (
                <div key={criterion.key} className="rounded-md border border-border p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {criterion.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {criterionLabel(criterion.key, assessmentValue(criterion.key, latest))}
                  </p>
                </div>
              ))}
            </div>

            {latest.decisionMakerName && (
              <p className="text-sm text-muted-foreground">
                Decision maker: {latest.decisionMakerName}
                {latest.decisionMakerDesignation
                  ? ` (${latest.decisionMakerDesignation})`
                  : ""}
              </p>
            )}

            {latest.notes && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{latest.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Assessed by {latest.qualifiedByName ?? "System"}</span>
              <span>·</span>
              <span>{new Date(latest.qualifiedAt).toLocaleString()}</span>
            </div>

            {state.history.length > 1 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Qualification history ({state.history.length})
                </p>
                <ol className="mt-2 space-y-2">
                  {state.history.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 text-sm">
                      <Badge variant={h.result === "qualified" ? "success" : h.result === "partially_qualified" ? "warning" : "danger"}>
                        {OUTCOME_LABELS[h.result as keyof typeof OUTCOME_LABELS] ?? h.result}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.qualifiedAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <Can permission="leads.edit">
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                Reassess
              </Button>
            </Can>
          </>
        )}
      </CardContent>
    </Card>
  );
}
