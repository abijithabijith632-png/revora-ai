import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Mail, Phone, Star, UserCog } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ClientService } from "@/server/services/clients";
import { LeadService } from "@/server/services/leads";
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
import {
  clientStatusLabel,
  clientStatusVariant,
  preferredChannelLabel,
} from "@/lib/clients/presentation";
import { ClientTimeline } from "@/components/clients";
import { ActivityTimeline } from "@/components/operations";

export const metadata = { title: "Client Detail" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "clients.view",
  );
  if (!allowed) redirect("/forbidden");

  const { id } = await params;
  const service = new ClientService(session.organizationId);
  const client = await service.getById(id).catch(() => null);
  if (!client) notFound();

  // Build a minimal timeline from the source lead's status history (if any).
  let timeline: { id: string; type: string; label: string; description?: string; occurredAt: string }[] = [];
  if (client.sourceLeadId) {
    const leadService = new LeadService(session.organizationId);
    const lead = await leadService.getById(client.sourceLeadId).catch(() => null);
    if (lead) {
      timeline = lead.statusHistory.map((h) => ({
        id: h.id,
        type: h.toStatus,
        label: `Lead ${h.toStatus}`,
        description: h.notes ?? undefined,
        occurredAt: h.changedAt.toISOString(),
      }));
    }
  }

  const activityService = new ActivityService(session.organizationId);
  const clientActivities = await activityService
    .timeline("client", id)
    .catch(() => []);
  const activityTimeline = clientActivities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    notes: a.notes,
    performedByName: a.performedByName,
    occurredAt: a.occurredAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.companyName}
        description={`${client.clientNumber} · ${client.industry ?? "No industry"}`}
        actions={
          <Link
            href={`/clients/${client.id}/edit`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-surface-subtle"
          >
            <Building2 className="h-4 w-4" />
            Edit
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={clientStatusVariant(client.status)} dot>
          {clientStatusLabel(client.status)}
        </Badge>
        {client.vipFlag && (
          <Badge variant="ai">
            <Star className="h-3 w-3" /> VIP
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Company" value={client.companyName} />
              <Field label="Industry" value={client.industry} />
              <Field label="Size" value={client.companySize} />
              <Field label="Website" value={client.website} isLink />
              <Field label="Account manager" value={client.accountManagerName} />
              <Field
                label="Customer since"
                value={client.customerSince?.toISOString().slice(0, 10) ?? null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Physical address" value={client.address} />
              <Field label="Billing address" value={client.billingAddress} />
            </CardContent>
          </Card>

          {client.corporateInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Corporate information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{client.corporateInfo}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Historical lead activity for this client.</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientTimeline events={timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Calls, emails, meetings, notes, and follow-ups.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activityTimeline} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Contacts
              </CardTitle>
              <CardDescription>
                {client.contacts.length} contact{client.contacts.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.contacts.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {c.firstName} {c.lastName ?? ""}
                    </p>
                    {c.isPrimary && <Badge variant="success">Primary</Badge>}
                  </div>
                  {c.designation && (
                    <p className="text-xs text-muted-foreground">{c.designation}</p>
                  )}
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {c.email && (
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {c.email}
                      </p>
                    )}
                    {c.phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                    {c.preferredChannel && (
                      <p>Preferred: {preferredChannelLabel(c.preferredChannel)}</p>
                    )}
                  </div>
                </div>
              ))}
              {client.contacts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This client has no contacts yet.
                </p>
              )}
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
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {value ? (
        isLink ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            {value}
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
