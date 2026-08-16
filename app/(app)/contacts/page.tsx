import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ContactService } from "@/server/services/contacts";
import { PageHeader } from "@/components/ui";
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

  const { rows, total } = await service.list({
    pagination: { page, pageSize, offset: (page - 1) * pageSize },
    sort: { column: "createdAt", order: "desc" },
    search: typeof sp.search === "string" ? sp.search : undefined,
    filters: {
      clientId:
        typeof sp.clientId === "string" && sp.clientId
          ? (sp.clientId as never)
          : undefined,
    },
  });

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

      <ContactTable
        initialRows={serializedRows}
        initialMeta={{ page, pageSize, total, totalPages }}
      />
    </div>
  );
}
