import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ContactService } from "@/server/services/contacts";
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableEmpty,
} from "@/components/ui";
import { preferredChannelLabel } from "@/lib/clients/presentation";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage people associated with your client accounts."
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Primary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">
                    {c.firstName} {c.lastName ?? ""}
                  </TableCell>
                  <TableCell>{c.clientName}</TableCell>
                  <TableCell>{c.designation ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {c.preferredChannel ? preferredChannelLabel(c.preferredChannel) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.isPrimary ? (
                      <Badge variant="success">
                        <Star className="h-3 w-3" /> Primary
                      </Badge>
                    ) : (
                      <Badge variant="neutral">—</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {rows.length === 0 && (
            <TableEmpty
              title="No contacts found"
              description="Contacts will appear here once they are added to a client."
            />
          )}

          <TablePagination
            page={page}
            pageCount={totalPages}
            total={total}
            onPageChange={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
