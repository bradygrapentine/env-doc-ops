import { NextResponse } from "next/server";
import { auditRepo, trafficRepo, reportRepo } from "@/lib/db";
import { generateReportSections } from "@/lib/reportGenerator";
import { planRegenerate } from "@/lib/reportRegenerate";
import { requireOwnedProject } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;
  const project = guard.project;

  const rows = await trafficRepo.listByProject(params.id);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Upload traffic count CSV before generating a report" },
      { status: 400 },
    );
  }

  const fresh = generateReportSections(project, rows);
  const existing = await reportRepo.getByProject(params.id);
  const { merged, refreshed, preserved } = planRegenerate(existing?.sections, fresh);
  const report = await reportRepo.upsertForProject(params.id, merged);

  await auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: existing ? "report.regenerate" : "report.generate",
    details: { refreshed: refreshed.length, preserved: preserved.length },
  });

  return NextResponse.json({
    reportId: report.id,
    sections: report.sections,
    refreshed,
    preserved,
  });
}
