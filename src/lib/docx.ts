import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";
import type { Project, Report, TrafficCountRow } from "./types";
import { calculateMetrics } from "./reportGenerator";

const PERIOD_ORDER: Record<string, number> = { AM: 0, MIDDAY: 1, PM: 2, OTHER: 3 };

function buildCoverPage(project: Project, report: Report): (Paragraph | Table)[] {
  const date = new Date(report.updatedAt).toLocaleDateString();
  const info: [string, string][] = [
    ["Location", project.location],
    ["Jurisdiction", project.jurisdiction],
    ["Client", project.clientName ?? "—"],
    ["Prepared by", project.preparedBy ?? "—"],
    ["Date", date],
  ];

  return [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Traffic Impact Report" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 360 },
      children: [new TextRun({ text: project.name, size: 32, bold: true })],
    }),
    ...info.map(
      ([label, value]) =>
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${label}: `, bold: true }),
            new TextRun({ text: value }),
          ],
        }),
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function cell(text: string, opts: { bold?: boolean; widthPct?: number } = {}): TableCell {
  return new TableCell({
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold ?? false })],
      }),
    ],
  });
}

function buildTrafficTable(rows: TrafficCountRow[]): Table {
  const sorted = [...rows].sort((a, b) => {
    const i = a.intersection.localeCompare(b.intersection);
    if (i !== 0) return i;
    return (PERIOD_ORDER[a.period] ?? 99) - (PERIOD_ORDER[b.period] ?? 99);
  });

  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Intersection", { bold: true, widthPct: 28 }),
      cell("Period", { bold: true, widthPct: 12 }),
      cell("Approach", { bold: true, widthPct: 20 }),
      cell("Inbound", { bold: true, widthPct: 13 }),
      cell("Outbound", { bold: true, widthPct: 13 }),
      cell("Total", { bold: true, widthPct: 14 }),
    ],
  });

  const dataRows = sorted.map(
    (r) =>
      new TableRow({
        children: [
          cell(r.intersection),
          cell(r.period),
          cell(r.approach ?? "—"),
          cell(String(r.inbound)),
          cell(String(r.outbound)),
          cell(String(r.total)),
        ],
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...dataRows],
    borders: standardBorders(),
  });
}

function buildPeakSummaryTable(rows: TrafficCountRow[]): Table {
  const m = calculateMetrics(rows);
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Period", { bold: true, widthPct: 25 }),
      cell("Peak intersection", { bold: true, widthPct: 50 }),
      cell("Total", { bold: true, widthPct: 25 }),
    ],
  });
  const amRow = new TableRow({
    children: [
      cell("AM Peak"),
      cell(m.highestAmIntersection ?? "No AM-period data"),
      cell(m.highestAmTotal !== undefined ? String(m.highestAmTotal) : "—"),
    ],
  });
  const pmRow = new TableRow({
    children: [
      cell("PM Peak"),
      cell(m.highestPmIntersection ?? "No PM-period data"),
      cell(m.highestPmTotal !== undefined ? String(m.highestPmTotal) : "—"),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, amRow, pmRow],
    borders: standardBorders(),
  });
}

function standardBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

export async function buildReportDocx(
  project: Project,
  report: Report,
  rows: TrafficCountRow[] = [],
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [...buildCoverPage(project, report)];

  for (const section of report.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: `${section.order}. ${section.title}` })],
      }),
    );
    for (const para of section.content.split(/\n+/)) {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: para })] }));
    }

    if (section.id === "existing-conditions" && rows.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: "Peak volumes" })],
        }),
        buildPeakSummaryTable(rows),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: "Counts by intersection" })],
        }),
        buildTrafficTable(rows),
      );
    }
  }

  const doc = new Document({
    creator: "EnvDocOS Traffic V1",
    title: `Traffic Impact Report — ${project.name}`,
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
