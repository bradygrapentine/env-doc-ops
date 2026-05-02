import { NextResponse } from "next/server";
import { auditRepo, reportRepo, trafficRepo } from "@/lib/db";
import { generateReportSections } from "@/lib/reportGenerator";
import { requireOwnedReport } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; sectionId: string } },
) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;
  const { project } = guard;

  const rows = await trafficRepo.listByProject(project.id);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Upload traffic count CSV before regenerating sections" },
      { status: 400 },
    );
  }

  const fresh = generateReportSections(project, rows);
  const match = fresh.find((s) => s.id === params.sectionId);
  if (!match) {
    return NextResponse.json({ error: "Section not found in current template" }, { status: 404 });
  }

  const updated = await reportRepo.updateSection(params.id, params.sectionId, {
    content: match.content,
    status: "draft",
    machineBaseline: match.machineBaseline,
  });
  if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  await auditRepo.log({
    projectId: project.id,
    userId: guard.userId,
    action: "section.regenerate",
    details: { sectionId: params.sectionId },
  });
  return NextResponse.json(updated);
}
