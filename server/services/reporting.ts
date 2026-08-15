import { BaseService } from "./base";
import { AnalyticsRepository } from "@/server/repositories/analytics";

interface ReportRow {
  label: string;
  value: string;
}

/**
 * Reporting engine (Phase 15). Report areas: leads, sales, pipeline,
 * customers. Uses real analytics aggregations and produces CSV/XLSX/PDF via a
 * self-contained generic exporter (the lead exporter is lead-specific).
 */
export class ReportingService extends BaseService {
  private readonly analytics: AnalyticsRepository;

  constructor(organizationId: string) {
    super();
    this.analytics = new AnalyticsRepository(organizationId);
  }

  async buildReport(
    area: string,
    format: "csv" | "xlsx" | "pdf",
  ): Promise<{ body: Buffer | string; contentType: string; extension: string }> {
    const dash = await this.analytics.dashboard();
    const attribution = await this.analytics.sourceAttribution();
    const pipeline = await this.analytics.pipelineByStage();

    const rows: ReportRow[] = [];
    let title = "Revora Report";

    if (area === "pipeline") {
      title = "Pipeline Report";
      for (const r of pipeline) {
        rows.push({ label: r.stageName ?? r.stage, value: `${r.count} deals · ₹${r.value}` });
      }
    } else if (area === "sales") {
      title = "Sales Report";
      rows.push(
        { label: "Total Pipeline Value", value: `₹${dash.totalPipelineValue}` },
        { label: "Weighted Pipeline", value: `₹${Math.round(dash.weightedPipelineValue)}` },
        { label: "Won Revenue", value: `₹${dash.totalRevenue}` },
        { label: "Won Deals", value: String(dash.wonDeals) },
        { label: "Lost Deals", value: String(dash.lostDeals) },
        { label: "Conversion Rate %", value: String(dash.conversionRate) },
      );
    } else if (area === "leads") {
      title = "Leads Report";
      for (const r of attribution) {
        rows.push({ label: r.source, value: String(r.count) });
      }
    } else {
      title = "Customers Report";
      rows.push(
        { label: "Active Opportunities", value: String(dash.activeOpportunities) },
        { label: "Total Leads", value: String(dash.totalLeads) },
        { label: "Qualified Leads", value: String(dash.qualifiedLeads) },
      );
    }

    if (format === "csv") {
      return {
        body: buildCsv(title, rows),
        contentType: "text/csv; charset=utf-8",
        extension: "csv",
      };
    }
    if (format === "xlsx") {
      return {
        body: await buildXlsx(title, rows),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
      };
    }
    return {
      body: await buildPdf(title, rows),
      contentType: "application/pdf",
      extension: "pdf",
    };
  }
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(title: string, rows: ReportRow[]): string {
  const lines = [`${title}`, "", "Metric,Value"];
  for (const r of rows) {
    lines.push(`${escapeCsv(r.label)},${escapeCsv(r.value)}`);
  }
  return lines.join("\n");
}

async function buildXlsx(title: string, rows: ReportRow[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRow([title]);
  sheet.addRow([]);
  sheet.addRow(["Metric", "Value"]);
  for (const r of rows) {
    sheet.addRow([r.label, r.value]);
  }
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 30;
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function buildPdf(title: string, rows: ReportRow[]): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown(1);
  for (const r of rows) {
    doc.fontSize(10).font("Helvetica-Bold").text(r.label, { continued: true });
    doc.font("Helvetica").text(`  ${r.value}`);
    doc.moveDown(0.3);
  }
  doc.end();
  return done;
}
