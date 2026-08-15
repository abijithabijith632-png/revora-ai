import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Target, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { OpportunityService } from "@/server/services/opportunities";
import { ActivityService } from "@/server/services/activities";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import { ActivityTimeline } from "@/components/operations";
import {
  stageLabel,
  stageVariant,
  allowedNextStages,
  type PipelineStageKey,
} from "@/lib/opportunities/pipeline";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Opportunity Detail" };

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "opportunities.view",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new OpportunityService(session.organizationId);
  const opp = await service.getById(id).catch(() => null);
  if (!opp) notFound();

  const activityService = new ActivityService(session.organizationId);
  const opportunityActivities = await activityService
    .timeline("opportunity", id)
    .catch(() => []);
  const timelineActivities = opportunityActivities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    notes: a.notes,
    performedByName: a.performedByName,
    occurredAt: a.occurredAt.toISOString(),
  }));

  const weighted = opp.amount != null && opp.probability != null
    ? (opp.amount * opp.probability) / 100
    : null;
  const nextStages = allowedNextStages((opp.stageKey ?? "new") as PipelineStageKey);

  const stageKey = opp.stageKey ?? "new";

  return (
    <div className="space-y-6">
      <PageHeader
        title={opp.name}
        description={`${opp.opportunityNumber} · ${opp.clientName}`}
        actions={
          <Link
            href={`/opportunities/${opp.id}/edit`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-surface-subtle"
          >
            <Target className="h-4 w-4" />
            Edit
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={stageVariant(stageKey)} dot>
          {stageLabel(stageKey)}
        </Badge>
        <Badge variant="neutral">{opp.source ?? "—"}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commercial</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Deal amount" value={formatMoney(opp.amount)} />
              <Field
                label="Probability"
                value={opp.probability != null ? `${opp.probability}%` : null}
              />
              <Field
                label="Weighted value"
                value={weighted != null ? formatMoney(weighted) : null}
              />
              <Field
                label="Expected close"
                value={opp.expectedCloseDate?.toISOString().slice(0, 10) ?? null}
              />
              <Field label="Source" value={opp.source} />
              <Field label="Product / Service" value={opp.productService} />
              <Field label="Owner" value={opp.ownerName} />
            </CardContent>
          </Card>

          {opp.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{opp.description}</p>
              </CardContent>
            </Card>
          )}

          {opp.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Deal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{opp.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Stage history</CardTitle>
              <CardDescription>Timeline of pipeline stage changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {opp.history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <p className="text-sm text-foreground">
                        {h.previousStageName ?? "Start"} → {h.newStageName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.previousProbability != null && h.newProbability != null
                          ? `${h.previousProbability}% → ${h.newProbability}% · `
                          : ""}
                        {h.changedByName ?? "System"} · {new Date(h.changedAt).toLocaleString()}
                      </p>
                      {h.reason && <p className="text-xs text-faint">{h.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Calls, emails, notes, and follow-ups for this opportunity.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={timelineActivities} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pipeline
              </CardTitle>
              <CardDescription>Current stage and available transitions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Current:{" "}
                <Badge variant={stageVariant(stageKey)}>{stageLabel(stageKey)}</Badge>
              </p>
              {nextStages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {nextStages.map((s) => (
                    <Badge key={s} variant="neutral">
                      {stageLabel(s)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Terminal stage — no further transitions.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link
                href={`/clients/${opp.clientId}`}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                {opp.clientName}
              </Link>
              <p className="text-xs text-muted-foreground">View client and contacts.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}
