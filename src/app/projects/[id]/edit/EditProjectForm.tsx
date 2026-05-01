"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";

export default function EditProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to update project");
      setSubmitting(false);
      return;
    }

    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 bg-white border rounded p-6">
      <Field name="name" label="Project name" required defaultValue={project.name} />
      <Field name="location" label="Location" required defaultValue={project.location} />
      <Field
        name="jurisdiction"
        label="Jurisdiction"
        required
        defaultValue={project.jurisdiction}
      />
      <Field name="clientName" label="Client" defaultValue={project.clientName ?? ""} />
      <Field name="projectType" label="Project type" required defaultValue={project.projectType} />
      <Field
        name="developmentSummary"
        label="Development summary"
        required
        textarea
        defaultValue={project.developmentSummary}
      />
      <Field name="preparedBy" label="Prepared by" defaultValue={project.preparedBy ?? ""} />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
        <Link
          href={`/projects/${project.id}`}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  textarea,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
        />
      ) : (
        <input
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      )}
    </label>
  );
}
