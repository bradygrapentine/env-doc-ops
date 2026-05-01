import { NextResponse } from "next/server";
import { trafficRepo } from "@/lib/db";
import { buildReportPdf } from "@/lib/pdf";
import { requireOwnedReport } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;
  const { project, report } = guard;

  const rows = trafficRepo.listByProject(report.projectId);
  const buf = await buildReportPdf(project, report, rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${report.id}.pdf"`,
    },
  });
}
