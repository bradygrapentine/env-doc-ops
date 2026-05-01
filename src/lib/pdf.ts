import PDFDocument from "pdfkit";
import type { Project, Report, TrafficCountRow } from "./types";
import { calculateMetrics } from "./reportGenerator";

const PERIOD_ORDER: Record<string, number> = { AM: 0, MIDDAY: 1, PM: 2, OTHER: 3 };

type PDFKitDoc = InstanceType<typeof PDFDocument>;

const PAGE_WIDTH = 612; // letter
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function renderCoverPage(doc: PDFKitDoc, project: Project, report: Report): void {
  const date = new Date(report.updatedAt).toLocaleDateString();
  const info: [string, string][] = [
    ["Location", project.location],
    ["Jurisdiction", project.jurisdiction],
    ["Client", project.clientName ?? "—"],
    ["Prepared by", project.preparedBy ?? "—"],
    ["Date", date],
  ];

  doc.font("Helvetica-Bold").fontSize(24).text("Traffic Impact Report", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(16).text(project.name, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(11);
  for (const [label, value] of info) {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
    doc.font("Helvetica").text(value);
    doc.moveDown(0.25);
  }

  doc.addPage();
}

function renderSectionHeading(doc: PDFKitDoc, text: string): void {
  doc.moveDown(0.75);
  doc.font("Helvetica-Bold").fontSize(14).text(text);
  doc.moveDown(0.25);
}

function renderSubHeading(doc: PDFKitDoc, text: string): void {
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(12).text(text);
  doc.moveDown(0.25);
}

function renderBody(doc: PDFKitDoc, content: string): void {
  doc.font("Helvetica").fontSize(11);
  for (const para of content.split(/\n+/)) {
    if (!para.trim()) continue;
    doc.text(para);
    doc.moveDown(0.4);
  }
}

function renderTable(doc: PDFKitDoc, headers: string[], rows: string[][], widths: number[]): void {
  const startX = doc.x;
  const totalW = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_WIDTH / totalW;
  const colW = widths.map((w) => w * scale);
  const rowHeight = 18;

  function drawRow(cells: string[], y: number, bold: boolean): void {
    let x = startX;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    for (let i = 0; i < cells.length; i++) {
      doc.rect(x, y, colW[i], rowHeight).strokeColor("#AAAAAA").stroke();
      doc.fillColor("#000000").text(cells[i], x + 4, y + 5, {
        width: colW[i] - 8,
        height: rowHeight - 2,
        ellipsis: true,
      });
      x += colW[i];
    }
  }

  let y = doc.y;
  drawRow(headers, y, true);
  y += rowHeight;
  for (const r of rows) {
    if (y + rowHeight > doc.page.height - MARGIN) {
      doc.addPage();
      y = doc.y;
    }
    drawRow(r, y, false);
    y += rowHeight;
  }
  doc.y = y + 4;
  doc.x = startX;
}

function renderPeakSummary(doc: PDFKitDoc, rows: TrafficCountRow[]): void {
  const m = calculateMetrics(rows);
  renderTable(
    doc,
    ["Period", "Peak intersection", "Total"],
    [
      [
        "AM Peak",
        m.highestAmIntersection ?? "No AM-period data",
        m.highestAmTotal !== undefined ? String(m.highestAmTotal) : "—",
      ],
      [
        "PM Peak",
        m.highestPmIntersection ?? "No PM-period data",
        m.highestPmTotal !== undefined ? String(m.highestPmTotal) : "—",
      ],
    ],
    [25, 50, 25],
  );
}

function renderTrafficTable(doc: PDFKitDoc, rows: TrafficCountRow[]): void {
  const sorted = [...rows].sort((a, b) => {
    const i = a.intersection.localeCompare(b.intersection);
    if (i !== 0) return i;
    return (PERIOD_ORDER[a.period] ?? 99) - (PERIOD_ORDER[b.period] ?? 99);
  });
  renderTable(
    doc,
    ["Intersection", "Period", "Approach", "Inbound", "Outbound", "Total"],
    sorted.map((r) => [
      r.intersection,
      r.period,
      r.approach ?? "—",
      String(r.inbound),
      String(r.outbound),
      String(r.total),
    ]),
    [28, 12, 20, 13, 13, 14],
  );
}

export async function buildReportPdf(
  project: Project,
  report: Report,
  rows: TrafficCountRow[] = [],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: MARGIN,
        info: {
          Title: `Traffic Impact Report — ${project.name}`,
          Creator: "EnvDocOS Traffic V1",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      renderCoverPage(doc, project, report);

      for (const section of report.sections) {
        renderSectionHeading(doc, `${section.order}. ${section.title}`);
        renderBody(doc, section.content);

        if (section.id === "existing-conditions" && rows.length > 0) {
          renderSubHeading(doc, "Peak volumes");
          renderPeakSummary(doc, rows);
          renderSubHeading(doc, "Counts by intersection");
          renderTrafficTable(doc, rows);
        }
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
