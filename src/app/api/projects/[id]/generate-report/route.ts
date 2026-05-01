import { NextResponse } from "next/server";
import { projectRepo, trafficRepo, reportRepo } from "@/lib/db";
import { generateReportSections } from "@/lib/reportGenerator";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const project = projectRepo.get(params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const rows = trafficRepo.listByProject(params.id);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Upload traffic count CSV before generating a report" }, { status: 400 });
  }

  const sections = generateReportSections(project, rows);
  const report = reportRepo.upsertForProject(params.id, sections);

  return NextResponse.json({ reportId: report.id, sections: report.sections });
}
