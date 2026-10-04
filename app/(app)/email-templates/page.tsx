import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EmailTemplateManager } from "@/components/commercial";
import { EmailTemplateService } from "@/server/services/email-templates";
import { parsePagination, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { emailTemplateFilterSchema } from "@/lib/commercial/schemas";

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
  const { rows } = await service.list({ pagination, sort, search, filters });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        description="Organization-wide reusable email templates."
      />
      <EmailTemplateManager initialTemplates={rows} />
    </div>
  );
}
