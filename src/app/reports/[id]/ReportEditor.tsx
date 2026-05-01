"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Report, ReportSection, SectionStatus, TrafficMetrics } from "@/lib/types";

const STATUSES: SectionStatus[] = ["draft", "reviewed", "final"];

export default function ReportEditor({
  report,
  metrics,
}: {
  report: Report;
  metrics: TrafficMetrics;
}) {
  const [sections, setSections] = useState<ReportSection[]>(report.sections);
  const [activeId, setActiveId] = useState<string>(report.sections[0]?.id ?? "");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const searchParams = useSearchParams();
  const titleById = useMemo(
    () => new Map(report.sections.map((s) => [s.id, s.title])),
    [report.sections],
  );
  const refreshed = (searchParams.get("refreshed") ?? "").split(",").filter(Boolean);
  const preserved = (searchParams.get("preserved") ?? "").split(",").filter(Boolean);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showBanner = !bannerDismissed && (refreshed.length > 0 || preserved.length > 0);

  const active = sections.find((s) => s.id === activeId);

  async function saveSection(section: ReportSection) {
    setSavingId(section.id);
    await fetch(`/api/reports/${report.id}/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: section.content, status: section.status }),
    });
    setSavingId(null);
  }

  function updateActive(patch: Partial<ReportSection>) {
    setSections((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...patch } : s)));
  }

  async function exportDocx() {
    setExporting(true);
    const res = await fetch(`/api/reports/${report.id}/export-docx`, { method: "POST" });
    if (!res.ok) {
      setExporting(false);
      alert("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report.id}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  const warnings: string[] = [];
  if (metrics.intersections.length === 0) warnings.push("No intersections found in count data.");
  if (metrics.totalAmVolume === 0) warnings.push("No AM-period rows.");
  if (metrics.totalPmVolume === 0) warnings.push("No PM-period rows.");

  return (
    <div className="space-y-4">
      {showBanner && (
        <div className="rounded border bg-blue-50 p-4 text-sm flex items-start justify-between gap-4">
          <div>
            <strong>{refreshed.length}</strong> section{refreshed.length === 1 ? "" : "s"} refreshed
            {preserved.length > 0 && (
              <>
                {" · "}
                <strong>{preserved.length}</strong> preserved (user-edited):{" "}
                <span className="text-blue-900">
                  {preserved.map((id) => titleById.get(id) ?? id).join(", ")}
                </span>
              </>
            )}
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-blue-900 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3 bg-white border rounded p-4 h-fit">
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveId(s.id)}
                  className={`w-full text-left rounded px-3 py-2 text-sm flex justify-between items-center ${
                    s.id === activeId ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  }`}
                >
                  <span>
                    {s.order}. {s.title}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      s.id === activeId ? "text-gray-300" : "text-gray-400"
                    }`}
                  >
                    {s.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={exportDocx}
            disabled={exporting}
            className="mt-4 w-full rounded bg-black text-white px-3 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
          >
            {exporting ? "Exporting…" : "Export DOCX"}
          </button>
        </aside>

        <section className="col-span-12 lg:col-span-6 bg-white border rounded p-6">
          {active ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium">
                  {active.order}. {active.title}
                </h2>
                <select
                  value={active.status}
                  onChange={(e) => updateActive({ status: e.target.value as SectionStatus })}
                  className="text-xs border rounded px-2 py-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={active.content}
                onChange={(e) => updateActive({ content: e.target.value })}
                rows={14}
                className="w-full border rounded p-3 text-sm font-mono"
              />
              <div className="mt-3 flex justify-end items-center gap-3">
                {savingId === active.id && <span className="text-xs text-gray-500">Saving…</span>}
                <button
                  onClick={() => saveSection(active)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Save section
                </button>
              </div>
            </>
          ) : (
            <div className="text-gray-500">No section selected.</div>
          )}
        </section>

        <aside className="col-span-12 lg:col-span-3 bg-white border rounded p-4 h-fit">
          <h3 className="font-medium mb-2 text-sm">Metrics</h3>
          <dl className="text-xs space-y-1.5 mb-4">
            <Row label="Intersections" value={metrics.intersections.length} />
            <Row label="Total AM" value={metrics.totalAmVolume} />
            <Row label="Total PM" value={metrics.totalPmVolume} />
            <Row label="Peak AM" value={metrics.highestAmIntersection ?? "—"} />
            <Row label="Peak PM" value={metrics.highestPmIntersection ?? "—"} />
          </dl>
          {warnings.length > 0 && (
            <>
              <h3 className="font-medium mb-2 text-sm">Warnings</h3>
              <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
