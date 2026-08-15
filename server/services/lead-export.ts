import { statusLabel, sourceLabel } from "@/lib/leads/presentation";

/**
 * Server-only lead export. Generates CSV, XLSX, and PDF files from the
 * repository's export row shape. `exceljs` and `pdfkit` are loaded lazily so
 * they never leak into the client bundle.
 */

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportRow {
  leadNumber: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  industry: string | null;
  geography: string | null;
  source: string;
  status: string;
  ownerName: string | null;
  budget: number | null;
  expectedClosingDate: Date | null;
  interestedProduct: string | null;
  aiScore: number | null;
  qualificationStatus: string;
  createdAt: Date;
}

export const EXPORT_COLUMNS = [
  "Lead Number",
  "First Name",
  "Last Name",
  "Full Name",
  "Email",
  "Phone",
  "Company",
  "Industry",
  "Geography",
  "Source",
  "Status",
  "Owner",
  "Budget",
  "Expected Close",
  "Product",
  "AI Score",
  "Qualification",
  "Created At",
] as const;

function rowValues(row: ExportRow): string[] {
  return [
    row.leadNumber,
    row.firstName ?? "",
    row.lastName ?? "",
    row.fullName,
    row.email ?? "",
    row.phone ?? "",
    row.companyName ?? "",
    row.industry ?? "",
    row.geography ?? "",
    sourceLabel(row.source),
    statusLabel(row.status),
    row.ownerName ?? "",
    row.budget != null ? String(row.budget) : "",
    row.expectedClosingDate ? row.expectedClosingDate.toISOString().slice(0, 10) : "",
    row.interestedProduct ?? "",
    row.aiScore != null ? String(row.aiScore) : "Not scored yet",
    row.qualificationStatus,
    row.createdAt.toISOString().slice(0, 10),
  ];
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.map(escapeCsv).join(",");
  const lines = rows.map((r) => rowValues(r).map(escapeCsv).join(","));
  return [header, ...lines].join("\n");
}

export async function buildXlsx(rows: ExportRow[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");

  sheet.columns = EXPORT_COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.max(12, header.length + 4),
  }));

  for (const row of rows) {
    sheet.addRow(rowValues(row));
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildPdf(rows: ExportRow[]): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(16).text("Leads Export", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown(1);

  const table = {
    headers: EXPORT_COLUMNS as readonly string[],
    rows: rows.map(rowValues),
  };

  const columnWidths = [
    80, 70, 70, 120, 150, 90, 120, 90, 80, 110, 80, 110, 60, 80, 100, 60, 90, 70,
  ];

  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 18;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

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

  drawRow(table.headers as unknown as string[], true);
  for (const row of table.rows) {
    drawRow(row, false);
  }

  doc.end();
  return done;
}

export async function buildExport(
  format: ExportFormat,
  rows: ExportRow[],
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
