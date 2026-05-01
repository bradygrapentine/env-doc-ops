import Link from "next/link";
import { projectRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const projects = projectRepo.list();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/projects/new" className="rounded bg-black text-white px-4 py-2 text-sm hover:bg-gray-800">
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded border border-dashed bg-white p-10 text-center text-gray-500">
          No projects yet. Create your first project to get started.
        </div>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block px-5 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.location} · {p.jurisdiction}</div>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
