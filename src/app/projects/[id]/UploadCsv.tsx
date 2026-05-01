"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UploadCsv({ projectId, initialRowCount }: { projectId: string; initialRowCount: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"idle" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rowsImported, setRowsImported] = useState<number>(initialRowCount);

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

  async function generate() {
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
    router.push(`/reports/${j.reportId}`);
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
          onClick={generate}
          disabled={rowsImported === 0 || busy !== "idle"}
          className="rounded bg-black text-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {busy === "generating" ? "Generating…" : "Generate Report"}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {rowsImported > 0 && busy === "idle" && (
        <div className="text-sm text-green-700">{rowsImported} rows imported.</div>
      )}
    </div>
  );
}
