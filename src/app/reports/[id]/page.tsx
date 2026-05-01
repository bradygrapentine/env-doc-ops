import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { trafficRepo } from "@/lib/db";
import { calculateMetrics } from "@/lib/reportGenerator";
import { getSessionUserId, requireReportAccess } from "@/lib/session";
import ReportEditor from "./ReportEditor";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/signin?callbackUrl=/reports/${params.id}`);
  const guard = await requireReportAccess(params.id, "read");
  if (!guard.ok) notFound();
  const { project, report, role } = guard;

  const rows = trafficRepo.listByProject(project.id);
  const metrics = calculateMetrics(rows);

  return (
    <div>
      <div className="mb-6">
        <Link href={`/projects/${project.id}`} className="text-sm text-gray-500 hover:underline">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Report</h1>
        <div className="text-sm text-gray-500">
          Last updated {new Date(report.updatedAt).toLocaleString()}
        </div>
      </div>

      <ReportEditor report={report} metrics={metrics} role={role} />
    </div>
  );
}
