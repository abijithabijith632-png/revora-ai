import { NextRequest } from "next/server";
import { failure, parseSort, parseSearch, parseFilters } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { recordAudit } from "@/lib/api/audit";
import { ClientService } from "@/server/services/clients";
import { buildExport, type ExportFormat } from "@/server/services/client-export";
import { clientFilterSchema } from "@/lib/clients/schemas";
import { ValidationError } from "@/lib/errors";

const SORT_ALLOWLIST = [
  "companyName",
  "createdAt",
  "customerSince",
  "status",
  "accountManagerId",
] as const;

const MAX_EXPORT_ROWS = 10_000;

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("clients.export");
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
    const filters = parseFilters(url, clientFilterSchema, [
      "status",
      "industry",
      "accountManagerId",
    ]);

    const service = new ClientService(session.organizationId);
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
      entityType: "client",
      metadata: { format: formatParam, count: rows.length },
    });

    const file = await buildExport(formatParam as ExportFormat, rows);
    const filename = `clients-${new Date().toISOString().slice(0, 10)}.${file.extension}`;

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
