"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SectionRef = { id: string; title: string };

export default function UploadCsv({
  projectId,
  initialRowCount,
}: {
  projectId: string;
  initialRowCount: number;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"idle" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rowsImported, setRowsImported] = useState<number>(initialRowCount);
  const [confirmation, setConfirmation] = useState<{
    refreshed: SectionRef[];
    preserved: SectionRef[];
  } | null>(null);

  async function upload() {
    if (!file) return;
    setBusy("uploading");
    setError(null);
    const text = await file.text();
    const res = await fetch(`/api/projects/${projectId}/traffic-data`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Upload failed");
      setBusy("idle");
      return;
    }
    const j = await res.json();
    setRowsImported(j.rowsImported);
    setBusy("idle");
    router.refresh();
  }

  async function startGenerate() {
    setBusy("generating");
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/generate-report/preview`, {
      method: "POST",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to preview regeneration");
      setBusy("idle");
      return;
    }
    const j = (await res.json()) as { refreshed: SectionRef[]; preserved: SectionRef[] };

    if (j.preserved.length === 0) {
      await runGenerate();
      return;
    }

    setConfirmation(j);
    setBusy("idle");
  }

  async function runGenerate() {
    setBusy("generating");
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/generate-report`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to generate report");
      setBusy("idle");
      return;
    }
    const j = await res.json();
    const refreshed = (j.refreshed ?? []).join(",");
    const preserved = (j.preserved ?? []).join(",");
    router.push(`/reports/${j.reportId}?refreshed=${refreshed}&preserved=${preserved}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          onClick={upload}
          disabled={!file || busy !== "idle"}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
        >
          {busy === "uploading" ? "Uploading…" : "Upload CSV"}
        </button>
        <button
          onClick={startGenerate}
          disabled={rowsImported === 0 || busy !== "idle"}
          className="rounded bg-black text-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {busy === "generating" ? "Generating…" : "Generate Report"}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {rowsImported > 0 && busy === "idle" && !confirmation && (
        <div className="text-sm text-green-700">{rowsImported} rows imported.</div>
      )}

      {confirmation && (
        <div className="rounded border bg-amber-50 p-4 text-sm space-y-3">
          <div>
            <strong>{confirmation.preserved.length}</strong> section
            {confirmation.preserved.length === 1 ? "" : "s"} will be preserved (you&apos;ve edited
            or marked them):
            <ul className="list-disc pl-5 mt-1 text-amber-900">
              {confirmation.preserved.map((s) => (
                <li key={s.id}>{s.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>{confirmation.refreshed.length}</strong> will be refreshed from current data.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmation(null);
                runGenerate();
              }}
              className="rounded bg-black text-white px-3 py-1.5 text-sm hover:bg-gray-800"
            >
              Refresh
            </button>
            <button
              onClick={() => setConfirmation(null)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
