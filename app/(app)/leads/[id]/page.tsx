import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Link as LinkIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LeadService } from "@/server/services/leads";
import { QualificationService } from "@/server/services/qualification";
import { LeadScoringService } from "@/server/services/lead-scoring";
import { ConversionService } from "@/server/services/conversion";
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import {
  sourceLabel,
  statusLabel,
  statusVariant,
  qualificationLabel,
  qualificationVariant,
} from "@/lib/leads/presentation";
import {
  LeadActions,
  LeadStatusHistory,
  LifecycleStepper,
  LeadQualification,
  AiScoreCard,
  LeadAssignment,
  LeadDuplicates,
  ConvertLeadButton,
} from "@/components/leads";

export const metadata = { title: "Lead Detail" };

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "leads.view",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new LeadService(session.organizationId);
  const qualificationService = new QualificationService(session.organizationId);
  const scoringService = new LeadScoringService(session.organizationId);
  const conversionService = new ConversionService(session.organizationId);

  const [lead, qualification, aiScore, conversion] = await Promise.all([
    service.getById(id).catch(() => null),
    qualificationService.getForLead(id).catch(() => null),
    scoringService.getForLead(id).catch(() => null),
    conversionService.preview(id).catch(() => null),
  ]);
  if (!lead) notFound();

  const convertedClient =
    conversion && lead.status === "converted" ? conversion.existingClient : null;
  const canConvert = lead.status === "qualified";

  const qualificationState = {
    outcome: qualification?.outcome ?? "pending",
    latest: qualification?.latest
      ? {
          ...qualification.latest,
          qualifiedAt: qualification.latest.qualifiedAt.toISOString(),
        }
      : null,
    history: (qualification?.history ?? []).map((h) => ({
      ...h,
      qualifiedAt: h.qualifiedAt.toISOString(),
    })),
  };

  const aiScoreState = {
    latest: aiScore?.latest
      ? {
          ...aiScore.latest,
          createdAt: aiScore.latest.createdAt.toISOString(),
        }
      : null,
    history: (aiScore?.history ?? []).map((h) => ({
      ...h,
      createdAt: h.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.fullName}
        description={`${lead.leadNumber} · ${lead.companyName ?? "No company"}`}
        actions={
          <div className="flex items-center gap-2">
            {canConvert && <ConvertLeadButton leadId={lead.id} />}
            <LeadActions leadId={lead.id} currentStatus={lead.status} />
          </div>
        }
      />

      {lead.status === "converted" && convertedClient && (
        <div className="rounded-md border border-success/40 bg-success-bg/30 p-3">
          <p className="text-sm text-success">
            Converted to Client{" "}
            <Link
              href={`/clients/${convertedClient.id}`}
              className="font-semibold underline"
            >
              {convertedClient.clientNumber}
            </Link>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(lead.status)} dot>
          {statusLabel(lead.status)}
        </Badge>
        <Badge variant="neutral">{sourceLabel(lead.source)}</Badge>
        <Badge variant={qualificationVariant(lead.qualificationStatus)}>
          {qualificationLabel(lead.qualificationStatus)}
        </Badge>
        {lead.aiScore == null ? (
          <Badge variant="neutral">Not scored yet</Badge>
        ) : (
          <Badge variant="ai">AI score {lead.aiScore}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>
            Current stage and progression toward conversion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LifecycleStepper current={lead.status} />
        </CardContent>
      </Card>

      <LeadDuplicates leadId={lead.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AiScoreCard
            leadId={lead.id}
            latest={aiScoreState.latest as never}
            history={aiScoreState.history as never}
          />
          <LeadAssignment leadId={lead.id} />

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" value={lead.firstName} />
              <Field label="Last name" value={lead.lastName} />
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Alternate phone" value={lead.alternatePhone} />
              <Field label="Website" value={lead.website} isLink />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Company" value={lead.companyName} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Size" value={lead.companySize} />
              <Field label="Geography" value={lead.geography} />
              <Field label="Budget" value={lead.budget != null ? String(lead.budget) : null} />
              <Field
                label="Expected close"
                value={lead.expectedClosingDate?.toISOString().slice(0, 10) ?? null}
              />
              <Field label="Interested product" value={lead.interestedProduct} />
              <Field label="Owner" value={lead.ownerName} />
            </CardContent>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <LeadQualification leadId={lead.id} state={qualificationState} />

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
              <CardDescription>
                Timeline of status changes for this lead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadStatusHistory
                history={lead.statusHistory.map((h) => ({
                  ...h,
                  changedAt: h.changedAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  isLink = false,
}: {
  label: string;
  value: string | null;
  isLink?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {value ? (
        isLink ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            {value}
            <LinkIcon className="h-3 w-3" />
          </a>
        ) : (
          <p className="mt-1 text-sm text-foreground">{value}</p>
        )
      ) : (
        <p className="mt-1 text-sm text-faint">—</p>
      )}
    </div>
  );
}
