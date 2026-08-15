import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { ProposalService } from "@/server/services/proposals";
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
  proposalStatusLabel,
  proposalStatusVariant,
} from "@/lib/commercial/presentation";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const proposal = await new ProposalService(session.organizationId)
    .getById(id)
    .catch(() => null);
  if (!proposal) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={proposal.title}
        description={`Opportunity: ${proposal.opportunityName}`}
        actions={
          <Badge variant={proposalStatusVariant(proposal.status)}>
            {proposalStatusLabel(proposal.status)}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Amount" value={formatMoney(proposal.amount)} />
              <Field label="Version" value={`v${proposal.version}`} />
              <Field label="Client" value={proposal.clientName ?? "—"} />
              <Field label="Owner" value={proposal.ownerName ?? "—"} />
              <Field
                label="Expiry"
                value={proposal.expiryDate?.toISOString().slice(0, 10) ?? "—"}
              />
              <Field label="Views" value={String(proposal.viewCount)} />
            </CardContent>
          </Card>

          {proposal.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{proposal.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Lifecycle
              </CardTitle>
              <CardDescription>Status change history.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {proposal.events.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <p className="text-sm text-foreground">
                        {ev.fromStatus ? `${proposalStatusLabel(ev.fromStatus)} → ` : ""}
                        {proposalStatusLabel(ev.toStatus)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ev.changedByName ?? "System"} ·{" "}
                        {new Date(ev.occurredAt).toLocaleString()}
                      </p>
                      {ev.notes && <p className="text-xs text-faint">{ev.notes}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opportunity</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/opportunities/${proposal.opportunityId}`}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                {proposal.opportunityName}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
