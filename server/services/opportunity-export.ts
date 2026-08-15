import { stageLabel } from "@/lib/opportunities/pipeline";

/**
 * Server-only opportunity export (CSV/XLSX/PDF), mirroring the lead/client
 * export approach with lazy-loaded exceljs/pdfkit.
 */

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface OpportunityExportRow {
  opportunityNumber: string;
  name: string;
  clientName: string;
  ownerName: string | null;
  stageName: string | null;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  source: string | null;
  productService: string | null;
  createdAt: Date;
}

const EXPORT_COLUMNS = [
  "Opportunity ID",
  "Name",
  "Client",
  "Owner",
  "Stage",
  "Amount",
  "Probability",
  "Expected Close",
  "Source",
  "Product/Service",
  "Created At",
] as const;

function rowValues(row: OpportunityExportRow): string[] {
  return [
    row.opportunityNumber,
    row.name,
    row.clientName,
    row.ownerName ?? "",
    row.stageName ?? "",
    row.amount != null ? String(row.amount) : "",
    row.probability != null ? `${row.probability}%` : "",
    row.expectedCloseDate ? row.expectedCloseDate.toISOString().slice(0, 10) : "",
    row.source ?? "",
    row.productService ?? "",
    row.createdAt.toISOString().slice(0, 10),
  ];
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(rows: OpportunityExportRow[]): string {
  const header = EXPORT_COLUMNS.map(escapeCsv).join(",");
  const lines = rows.map((r) => rowValues(r).map(escapeCsv).join(","));
  return [header, ...lines].join("\n");
}

export async function buildXlsx(rows: OpportunityExportRow[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Opportunities");

  sheet.columns = EXPORT_COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.max(12, header.length + 4),
  }));

  for (const row of rows) sheet.addRow(rowValues(row));

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildPdf(rows: OpportunityExportRow[]): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(16).text("Opportunities Export", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown(1);

  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 18;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const columnWidths = [80, 120, 110, 90, 80, 70, 60, 80, 80, 110, 70];

  function drawRow(cells: string[], bold: boolean) {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    let x = startX;
    doc.fontSize(8);
    cells.forEach((cell, i) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .text(cell, x, y, {
          width: columnWidths[i] - 4,
          height: rowHeight,
          ellipsis: true,
          lineBreak: false,
        });
      x += columnWidths[i];
    });
    y += rowHeight;
  }

  drawRow(EXPORT_COLUMNS as unknown as string[], true);
  for (const row of rows) drawRow(rowValues(row), false);

  doc.end();
  return done;
}

export async function buildExport(
  format: ExportFormat,
  rows: OpportunityExportRow[],
): Promise<{ body: Buffer | string; contentType: string; extension: string }> {
  if (format === "csv") {
    return {
      body: buildCsv(rows),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }
  if (format === "xlsx") {
    return {
      body: await buildXlsx(rows),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }
  return {
    body: await buildPdf(rows),
    contentType: "application/pdf",
    extension: "pdf",
  };
}

// Re-export for convenience in route handlers.
export { stageLabel };
