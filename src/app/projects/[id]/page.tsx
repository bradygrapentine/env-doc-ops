import Link from "next/link";
import { notFound } from "next/navigation";
import { projectRepo, trafficRepo } from "@/lib/db";
import { calculateMetrics } from "@/lib/reportGenerator";
import UploadCsv from "./UploadCsv";
import DeleteButton from "./DeleteButton";
import ManualInputsForm from "./ManualInputsForm";

export const dynamic = "force-dynamic";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const project = projectRepo.get(params.id);
  if (!project) notFound();

  const rows = trafficRepo.listByProject(params.id);
  const metrics = calculateMetrics(rows);

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Projects
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <Link
            href={`/projects/${project.id}/edit`}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Edit
          </Link>
          <DeleteButton projectId={project.id} projectName={project.name} />
        </div>
        <div className="text-sm text-gray-500">
          {project.location} · {project.jurisdiction}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border rounded p-6">
          <h2 className="font-medium mb-2">Traffic Count Data</h2>
          <p className="text-sm text-gray-500 mb-4">
            Required CSV columns:{" "}
            <code className="bg-gray-100 px-1 rounded">
              intersection,period,approach,inbound,outbound,total
            </code>
            .<code className="bg-gray-100 px-1 rounded ml-1">period</code> must be AM, PM, MIDDAY,
            or OTHER.
          </p>
          <UploadCsv projectId={project.id} initialRowCount={rows.length} />

          {rows.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Imported rows ({rows.length})</h3>
              <div className="overflow-x-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Intersection", "Period", "Approach", "Inbound", "Outbound", "Total"].map(
                        (h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2">{r.intersection}</td>
                        <td className="px-3 py-2">{r.period}</td>
                        <td className="px-3 py-2">{r.approach ?? "—"}</td>
                        <td className="px-3 py-2">{r.inbound}</td>
                        <td className="px-3 py-2">{r.outbound}</td>
                        <td className="px-3 py-2">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <div className="text-xs text-gray-500 px-3 py-2 bg-gray-50">
                    Showing first 50 of {rows.length}.
                  </div>
                )}
              </div>
            </div>
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

        <div className="lg:col-span-2">
          <ManualInputsForm projectId={project.id} initial={project.manualInputs} />
        </div>
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
