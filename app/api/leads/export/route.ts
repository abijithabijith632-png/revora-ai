import { NextRequest } from "next/server";
import { failure, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { recordAudit } from "@/lib/api/audit";
import { LeadService } from "@/server/services/leads";
import { buildExport, type ExportFormat } from "@/server/services/lead-export";
import { leadFilterSchema } from "@/lib/leads/schemas";
import { ValidationError } from "@/lib/errors";

const SORT_ALLOWLIST = [
  "createdAt",
  "updatedAt",
  "fullName",
  "companyName",
  "status",
  "source",
  "aiScore",
] as const;

const MAX_EXPORT_ROWS = 10_000;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("leads.export");
    const url = req.nextUrl;

    const formatParam = url.searchParams.get("format") ?? "csv";
    const formats: ExportFormat[] = ["csv", "xlsx", "pdf"];
    if (!formats.includes(formatParam as ExportFormat)) {
      throw new ValidationError("Format must be csv, xlsx, or pdf.");
    }

    checkRateLimit(
      rateLimitKey(session.userId, req.headers.get("x-forwarded-for") ?? ""),
      20,
      60_000,
    );

    const sort = parseSort(url, SORT_ALLOWLIST, "createdAt", "desc");
    const search = parseSearch(url);
    const filters = parseFilters(url, leadFilterSchema, [
      "status",
      "source",
      "ownerId",
    ]);

    const service = new LeadService(session.organizationId);
    const rows = await service.exportRows({
      sort,
      search,
      filters,
      limit: MAX_EXPORT_ROWS,
    });

    await recordAudit({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "export",
      entityType: "lead",
      metadata: { format: formatParam, count: rows.length },
    });

    const file = await buildExport(formatParam as ExportFormat, rows);
    const filename = `leads-${new Date().toISOString().slice(0, 10)}.${file.extension}`;

    const body: BodyInit =
      typeof file.body === "string" ? file.body : new Uint8Array(file.body);

    return new Response(body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
