"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SectionRef = { id: string; title: string };

type RowIssue = { row: number; column?: string; message: string };
type ParsedRow = {
  intersection: string;
  period: string;
  approach?: string;
  inbound: number;
  outbound: number;
  total: number;
};
type InvalidRow = { row: number; raw: Record<string, string>; issues: RowIssue[] };
type PreviewResult = {
  headers: string[];
  totalRows: number;
  validRows: ParsedRow[];
  invalidRows: InvalidRow[];
  fatal?: string;
};

type PreviewTableRow = {
  row: number;
  intersection: string;
  period: string;
  approach: string;
  inbound: string;
  outbound: string;
  total: string;
  issues: RowIssue[];
  invalid: boolean;
};

function buildTableRows(preview: PreviewResult): PreviewTableRow[] {
  const rows: PreviewTableRow[] = [];
  preview.validRows.forEach((r, idx) => {
    // Valid row indices map back to data rows by position is non-trivial without source row.
    // We approximate the row number by walking the union sorted by row number.
    rows.push({
      row: idx, // placeholder; replaced below
      intersection: r.intersection,
      period: r.period,
      approach: r.approach ?? "",
      inbound: String(r.inbound),
      outbound: String(r.outbound),
      total: String(r.total),
      issues: [],
      invalid: false,
    });
  });
  // We need actual row numbers for valid rows. Reconstruct by reading invalidRows + total.
  // Simpler: assign rows 2..(totalRows+1) and skip the row numbers occupied by invalidRows.
  const invalidByRow = new Map<number, InvalidRow>();
  preview.invalidRows.forEach((ir) => invalidByRow.set(ir.row, ir));

  const final: PreviewTableRow[] = [];
  let validIdx = 0;
  for (let n = 2; n < preview.totalRows + 2; n++) {
    const inv = invalidByRow.get(n);
    if (inv) {
      final.push({
        row: n,
        intersection: inv.raw.intersection ?? "",
        period: inv.raw.period ?? "",
        approach: inv.raw.approach ?? "",
        inbound: inv.raw.inbound ?? "",
        outbound: inv.raw.outbound ?? "",
        total: inv.raw.total ?? "",
        issues: inv.issues,
        invalid: true,
      });
    } else {
      const v = preview.validRows[validIdx++];
      if (v) {
        final.push({
          row: n,
          intersection: v.intersection,
          period: v.period,
          approach: v.approach ?? "",
          inbound: String(v.inbound),
          outbound: String(v.outbound),
          total: String(v.total),
          issues: [],
          invalid: false,
        });
      }
    }
  }
  return final;
}

export default function UploadCsv({
  projectId,
  initialRowCount,
}: {
  projectId: string;
  initialRowCount: number;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"idle" | "previewing" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rowsImported, setRowsImported] = useState<number>(initialRowCount);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    refreshed: SectionRef[];
    preserved: SectionRef[];
  } | null>(null);

  function resetPreview() {
    setPreview(null);
    setPendingText(null);
    setError(null);
    setFile(null);
  }

  async function previewFile() {
    if (!file) return;
    setBusy("previewing");
    setError(null);
    setPreview(null);
    const text = await file.text();
    setPendingText(text);
    const res = await fetch(`/api/projects/${projectId}/traffic-data/preview`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Preview failed");
      setBusy("idle");
      return;
    }
    setPreview(j as PreviewResult);
    setBusy("idle");
  }

  async function confirmImport() {
    if (!pendingText) return;
    setBusy("uploading");
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/traffic-data`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: pendingText,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Upload failed");
      setBusy("idle");
      return;
    }
    const j = await res.json();
    setRowsImported(j.rowsImported);
    setPreview(null);
    setPendingText(null);
    setFile(null);
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

  const tableRows = preview ? buildTableRows(preview) : [];
  const hasInvalid = preview ? preview.invalidRows.length > 0 : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setPendingText(null);
            setError(null);
          }}
          className="text-sm"
        />
        <button
          onClick={previewFile}
          disabled={!file || busy !== "idle"}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
        >
          {busy === "previewing" ? "Previewing…" : "Preview"}
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
      {rowsImported > 0 && busy === "idle" && !confirmation && !preview && (
        <div className="text-sm text-green-700">{rowsImported} rows imported.</div>
      )}

      {preview && (
        <div className="rounded border bg-white p-4 text-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <strong>{preview.validRows.length}</strong> valid row
              {preview.validRows.length === 1 ? "" : "s"},{" "}
              <strong className={hasInvalid ? "text-red-700" : ""}>
                {preview.invalidRows.length}
              </strong>{" "}
              invalid row{preview.invalidRows.length === 1 ? "" : "s"}.
            </div>
            <button
              onClick={resetPreview}
              className="text-sm text-blue-700 hover:underline"
              type="button"
            >
              Pick a different file
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Intersection</th>
                  <th className="px-2 py-1">Period</th>
                  <th className="px-2 py-1">Approach</th>
                  <th className="px-2 py-1">Inbound</th>
                  <th className="px-2 py-1">Outbound</th>
                  <th className="px-2 py-1">Total</th>
                  <th className="px-2 py-1">Issues</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.row} className={r.invalid ? "bg-red-50 border-b" : "border-b"}>
                    <td className="px-2 py-1">{r.row}</td>
                    <td className="px-2 py-1">{r.intersection}</td>
                    <td className="px-2 py-1">{r.period}</td>
                    <td className="px-2 py-1">{r.approach}</td>
                    <td className="px-2 py-1">{r.inbound}</td>
                    <td className="px-2 py-1">{r.outbound}</td>
                    <td className="px-2 py-1">{r.total}</td>
                    <td className="px-2 py-1 text-red-700">
                      {r.issues.length === 0 ? (
                        ""
                      ) : (
                        <ul className="list-disc pl-4">
                          {r.issues.map((iss, idx) => (
                            <li key={idx}>{iss.message}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            {hasInvalid ? (
              <button
                disabled
                className="rounded bg-gray-300 text-gray-700 px-3 py-1.5 text-sm cursor-not-allowed"
              >
                Confirm import (resolve issues first)
              </button>
            ) : (
              <button
                onClick={confirmImport}
                disabled={busy !== "idle"}
                className="rounded bg-green-700 text-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-green-800"
              >
                {busy === "uploading"
                  ? "Importing…"
                  : `Confirm import (${preview.validRows.length} rows)`}
              </button>
            )}
          </div>
        </div>
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
