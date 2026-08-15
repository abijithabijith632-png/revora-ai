import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui";
import { EmailTemplateService } from "@/server/services/email-templates";
import { parsePagination, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { emailTemplateFilterSchema } from "@/lib/commercial/schemas";
import { emailTemplateCategoryLabel } from "@/lib/commercial/presentation";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const url = new URL("https://local");
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") url.searchParams.set(k, v);
  }

  const pagination = parsePagination(url);
  const sort = parseSort(url, ["name", "createdAt"] as const, "createdAt", "desc");
  const search = parseSearch(url);
  const filters = parseFilters(url, emailTemplateFilterSchema, ["category", "archived"]);

  const service = new EmailTemplateService(session.organizationId);
  const { rows, total } = await service.list({ pagination, sort, search, filters });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        description="Organization-wide reusable email templates."
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                  <TableCell>{emailTemplateCategoryLabel(t.category)}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {rows.length === 0 && (
            <TableEmpty
              title="No email templates yet"
              description={`${total} templates in this organization.`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
