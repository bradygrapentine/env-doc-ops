import { NextResponse } from "next/server";
import { trafficRepo, reportRepo } from "@/lib/db";
import { generateReportSections } from "@/lib/reportGenerator";
import { planRegenerate } from "@/lib/reportRegenerate";
import { requireOwnedProject } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;
  const project = guard.project;

  const rows = trafficRepo.listByProject(params.id);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Upload traffic count CSV before generating a report" },
      { status: 400 },
    );
  }

  const fresh = generateReportSections(project, rows);
  const existing = reportRepo.getByProject(params.id);
  const { merged, refreshed, preserved } = planRegenerate(existing?.sections, fresh);
  const report = reportRepo.upsertForProject(params.id, merged);

  return NextResponse.json({
    reportId: report.id,
    sections: report.sections,
    refreshed,
    preserved,
  });
}
