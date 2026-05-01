"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import EditProjectForm from "./EditProjectForm";

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${params.id}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Failed to load project");
          setLoading(false);
          return;
        }
        const p = await res.json();
        setProject(p);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load project");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (notFound) return <div className="text-sm text-red-600">Project not found.</div>;
  if (!project)
    return <div className="text-sm text-red-600">{error ?? "Failed to load project"}</div>;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href={`/projects/${params.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to project
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Edit Project</h1>
      </div>
      <EditProjectForm project={project} />
    </div>
  );
}
