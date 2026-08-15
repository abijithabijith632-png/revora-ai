import { NextRequest } from "next/server";
import { failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ReportingService } from "@/server/services/reporting";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("reports.view");
    const url = req.nextUrl;
    const area = url.searchParams.get("area") ?? "sales";
    const format = (url.searchParams.get("format") ?? "csv") as "csv" | "xlsx" | "pdf";

    const service = new ReportingService(session.organizationId);
    const { body, contentType, extension } = await service.buildReport(area, format);

    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${area}-report.${extension}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
