import Link from "next/link";
import { projectRepo } from "@/lib/db";
import ProjectList from "./ProjectList";

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

      <ProjectList projects={projects} />
    </div>
  );
}
