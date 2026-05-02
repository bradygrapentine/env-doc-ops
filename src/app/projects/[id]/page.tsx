import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { trafficRepo } from "@/lib/db";
import { calculateMetrics } from "@/lib/reportGenerator";
import { getSessionUserId, requireProjectAccess } from "@/lib/session";
import UploadCsv from "./UploadCsv";
import DeleteButton from "./DeleteButton";
import ManualInputsForm from "./ManualInputsForm";
import TrafficRowsManager from "./TrafficRowsManager";
import SharesPanel from "./SharesPanel";
import AuditPanel from "./AuditPanel";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/signin?callbackUrl=/projects/${params.id}`);
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) notFound();
  const { project, role } = guard;
  const isOwner = role === "owner";

  const rows = await trafficRepo.listByProject(params.id);
  const metrics = calculateMetrics(rows);

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Projects
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {isOwner ? (
            <>
              <Link
                href={`/projects/${project.id}/edit`}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Edit
              </Link>
              <DeleteButton projectId={project.id} projectName={project.name} />
            </>
          ) : (
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
              Shared with you (read-only)
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {project.location} · {project.jurisdiction}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border rounded p-6">
          <h2 className="font-medium mb-2">Traffic Count Data</h2>
          {isOwner && (
            <p className="text-sm text-gray-500 mb-4">
              Required CSV columns:{" "}
              <code className="bg-gray-100 px-1 rounded">
                intersection,period,approach,inbound,outbound,total
              </code>
              .<code className="bg-gray-100 px-1 rounded ml-1">period</code> must be AM, PM, MIDDAY,
              or OTHER.
            </p>
          )}
          {isOwner && <UploadCsv projectId={project.id} initialRowCount={rows.length} />}

          {isOwner ? (
            <TrafficRowsManager projectId={project.id} initialRows={rows} />
          ) : (
            <ReadOnlyRows rows={rows} />
          )}
        </section>

        <aside className="bg-white border rounded p-6 h-fit">
          <h2 className="font-medium mb-3">Summary</h2>
          <dl className="text-sm space-y-2">
            <Row label="Intersections" value={metrics.intersections.length} />
            <Row label="Total AM volume" value={metrics.totalAmVolume} />
            <Row label="Total PM volume" value={metrics.totalPmVolume} />
            <Row
              label="Peak AM"
              value={
                metrics.highestAmIntersection
                  ? `${metrics.highestAmIntersection} (${metrics.highestAmTotal})`
                  : "—"
              }
            />
            <Row
              label="Peak PM"
              value={
                metrics.highestPmIntersection
                  ? `${metrics.highestPmIntersection} (${metrics.highestPmTotal})`
                  : "—"
              }
            />
          </dl>
        </aside>

        {isOwner && (
          <div className="lg:col-span-2">
            <ManualInputsForm projectId={project.id} initial={project.manualInputs} />
          </div>
        )}

        {isOwner && (
          <div className="lg:col-span-2">
            <SharesPanel projectId={project.id} />
          </div>
        )}

        {isOwner && (
          <div className="lg:col-span-2">
            <AuditPanel projectId={project.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

function ReadOnlyRows({
  rows,
}: {
  rows: {
    id: string;
    intersection: string;
    period: string;
    approach?: string;
    inbound: number;
    outbound: number;
    total: number;
  }[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No traffic count rows.</p>;
  }
  return (
    <div className="overflow-x-auto mt-4">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-2 py-1">Intersection</th>
            <th className="px-2 py-1">Period</th>
            <th className="px-2 py-1">Approach</th>
            <th className="px-2 py-1 text-right">In</th>
            <th className="px-2 py-1 text-right">Out</th>
            <th className="px-2 py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-1">{r.intersection}</td>
              <td className="px-2 py-1">{r.period}</td>
              <td className="px-2 py-1">{r.approach ?? ""}</td>
              <td className="px-2 py-1 text-right">{r.inbound}</td>
              <td className="px-2 py-1 text-right">{r.outbound}</td>
              <td className="px-2 py-1 text-right">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
