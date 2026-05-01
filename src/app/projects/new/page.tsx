"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to create project");
      setSubmitting(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">Create Project</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-white border rounded p-6">
        <Field name="name" label="Project name" required />
        <Field name="location" label="Location" required />
        <Field name="jurisdiction" label="Jurisdiction" required />
        <Field name="clientName" label="Client" />
        <Field
          name="projectType"
          label="Project type"
          required
          placeholder="e.g. Mixed-use development"
        />
        <Field
          name="developmentSummary"
          label="Development summary"
          required
          textarea
          placeholder="e.g. 120 residential units and 15,000 sq ft of retail"
        />
        <Field name="preparedBy" label="Prepared by" />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {submitting ? "Creating…" : "Create Project"}
        </button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  placeholder,
  textarea,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
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
          placeholder={placeholder}
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
        />
      ) : (
        <input
          name={name}
          required={required}
          placeholder={placeholder}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      )}
    </label>
  );
}
