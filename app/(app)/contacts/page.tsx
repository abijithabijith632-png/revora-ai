import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ContactService } from "@/server/services/contacts";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { ContactTable } from "@/components/clients";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "contacts.view",
  );
  if (!allowed) redirect("/forbidden");

  const sp = await searchParams;
  const service = new ContactService(session.organizationId);

  const page = Number(sp.page ?? "1") || 1;
  const pageSize = Math.min(Number(sp.pageSize ?? "20") || 20, 100);

  const [{ rows, total }, quality] = await Promise.all([service.list({
    pagination: { page, pageSize, offset: (page - 1) * pageSize },
    sort: { column: "createdAt", order: "desc" },
    search: typeof sp.search === "string" ? sp.search : undefined,
    filters: {
      clientId:
        typeof sp.clientId === "string" && sp.clientId
          ? (sp.clientId as never)
          : undefined,
    },
  }), service.dataQuality()]);

  const totalPages = Math.ceil(total / pageSize);

  const serializedRows = rows.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage people associated with your client accounts."
      />

      <Card>
        <CardHeader><CardTitle>Contact data quality</CardTitle><CardDescription>Suggestions only. Review records before making changes.{quality.truncated ? " Review covers the most recently updated 1,000 contacts." : ""}</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">Possible duplicate contacts: {quality.duplicateContactCount}</p>
          {quality.issues.length ? quality.issues.slice(0, 8).map((issue, index) => <p key={`${issue.contactId}-${index}`} className="text-sm text-muted-foreground">{issue.issue} — {issue.suggestion}</p>) : <p className="text-sm text-muted-foreground">No obvious contact data issues detected.</p>}
          <p className="text-xs text-faint">No records were changed or merged automatically.</p>
        </CardContent>
      </Card>

      <ContactTable
        initialRows={serializedRows}
        initialMeta={{ page, pageSize, total, totalPages }}
      />
    </div>
  );
}
