import { NextResponse } from "next/server";
import { reportRepo, projectRepo } from "@/lib/db";
import { buildReportDocx } from "@/lib/docx";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const report = reportRepo.get(params.id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const project = projectRepo.get(report.projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const buf = await buildReportDocx(project, report);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="report-${report.id}.docx"`,
    },
  });
}
