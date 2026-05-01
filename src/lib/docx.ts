import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { Project, Report } from "./types";

export async function buildReportDocx(project: Project, report: Report): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: `Traffic Impact Report — ${project.name}` })],
    }),
    new Paragraph({ children: [new TextRun({ text: `Location: ${project.location}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Jurisdiction: ${project.jurisdiction}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Prepared by: ${project.preparedBy ?? "—"}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Date: ${new Date(report.updatedAt).toLocaleDateString()}` })] }),
    new Paragraph({ children: [new TextRun({ text: "" })] }),
  ];

  for (const section of report.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: `${section.order}. ${section.title}` })],
      }),
    );
    for (const para of section.content.split(/\n+/)) {
      children.push(new Paragraph({ children: [new TextRun({ text: para })] }));
    }
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
