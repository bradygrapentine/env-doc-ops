import { NextResponse } from "next/server";
import { projectRepo, trafficRepo, reportRepo } from "@/lib/db";
import { generateReportSections } from "@/lib/reportGenerator";
import { planRegenerate } from "@/lib/reportRegenerate";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const project = projectRepo.get(params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const rows = trafficRepo.listByProject(params.id);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Upload traffic count CSV before generating a report" },
      { status: 400 },
    );
  }

  const fresh = generateReportSections(project, rows);
  const existing = reportRepo.getByProject(params.id);
  const { refreshed, preserved } = planRegenerate(existing?.sections, fresh);

  const titlesById = new Map(fresh.map((s) => [s.id, s.title]));
  return NextResponse.json({
    refreshed: refreshed.map((id) => ({ id, title: titlesById.get(id) ?? id })),
    preserved: preserved.map((id) => ({ id, title: titlesById.get(id) ?? id })),
  });
}
