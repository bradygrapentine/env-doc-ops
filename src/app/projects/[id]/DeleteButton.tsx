"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to delete project");
      setDeleting(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
      >
        Delete
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg max-w-md w-full p-6">
            <h2 className="font-medium text-lg mb-3">Delete project?</h2>
            <p className="text-sm text-gray-700 mb-4">
              Delete {projectName}? This will also delete its uploaded CSV rows and any generated
              report. This cannot be undone.
            </p>
            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="rounded bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
