"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ProjectAccessRole,
  Report,
  ReportSection,
  SectionStatus,
  TrafficMetrics,
} from "@/lib/types";

const STATUSES: SectionStatus[] = ["draft", "reviewed", "final"];

export default function ReportEditor({
  report,
  metrics,
  role = "owner",
}: {
  report: Report;
  metrics: TrafficMetrics;
  role?: ProjectAccessRole;
}) {
  const readOnly = role === "reader";
  const [sections, setSections] = useState<ReportSection[]>(report.sections);
  const [activeId, setActiveId] = useState<string>(report.sections[0]?.id ?? "");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  async function regenerateSection(section: ReportSection) {
    const ok = window.confirm(
      "Replace this section's text with the latest auto-generated draft? Your edits to this section will be lost.",
    );
    if (!ok) return;
    setRegenerateError(null);
    setRegeneratingId(section.id);
    try {
      const res = await fetch(`/api/reports/${report.id}/sections/${section.id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setRegenerateError(body?.error ?? "Regenerate failed");
        return;
      }
      const updated = (await res.json()) as Report;
      const fresh = updated.sections.find((s) => s.id === section.id);
      if (fresh) {
        setSections((prev) => prev.map((s) => (s.id === section.id ? fresh : s)));
      }
    } finally {
      setRegeneratingId(null);
    }
  }

  function updateActive(patch: Partial<ReportSection>) {
    setSections((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...patch } : s)));
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.id === a.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const previous = sections;
    const next = arrayMove(sections, oldIdx, newIdx).map((s, i) => ({ ...s, order: i + 1 }));
    setSections(next);
    setReorderError(null);
    const res = await fetch(`/api/reports/${report.id}/sections/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((s) => s.id) }),
    });
    if (!res.ok) {
      setSections(previous);
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setReorderError(body?.error ?? "Reorder failed");
    }
  }

  async function submitAddSection(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const title = newTitle.trim();
    if (!title) {
      setAddError("Title is required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: "" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setAddError(body?.error ?? "Add failed");
        return;
      }
      const section = (await res.json()) as ReportSection;
      setSections((prev) => [...prev, section]);
      setActiveId(section.id);
      setNewTitle("");
      setShowAddForm(false);
    } finally {
      setAdding(false);
    }
  }

  async function deleteCustom(section: ReportSection) {
    if (!window.confirm("Delete this custom section?")) return;
    const res = await fetch(`/api/reports/${report.id}/sections/${section.id}`, {
      method: "DELETE",
    });
    if (res.status === 204) {
      setSections((prev) => {
        const next = prev.filter((s) => s.id !== section.id);
        if (section.id === activeId) setActiveId(next[0]?.id ?? "");
        return next;
      });
    }
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

  async function exportPdf() {
    setExportingPdf(true);
    const res = await fetch(`/api/reports/${report.id}/export-pdf`, { method: "POST" });
    if (!res.ok) {
      setExportingPdf(false);
      alert("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportingPdf(false);
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
          {mounted && !readOnly ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-1">
                  {sections.map((s) => (
                    <SortableRow
                      key={s.id}
                      section={s}
                      isActive={s.id === activeId}
                      onSelect={() => setActiveId(s.id)}
                      onDelete={s.kind === "custom" ? () => deleteCustom(s) : undefined}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
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
          )}

          {reorderError && <div className="mt-2 text-xs text-red-600">{reorderError}</div>}

          {readOnly ? null : showAddForm ? (
            <form onSubmit={submitAddSection} className="mt-3 space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Section title"
                maxLength={200}
                className="w-full border rounded px-2 py-1 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded bg-black text-white px-3 py-1 text-xs disabled:opacity-50"
                >
                  {adding ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTitle("");
                    setAddError(null);
                  }}
                  className="rounded border px-3 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
              {addError && <div className="text-xs text-red-600">{addError}</div>}
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 w-full rounded border border-dashed px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
            >
              + Add custom section
            </button>
          )}

          <button
            onClick={exportDocx}
            disabled={exporting}
            className="mt-4 w-full rounded bg-black text-white px-3 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
          >
            {exporting ? "Exporting…" : "Export DOCX"}
          </button>
          <button
            onClick={exportPdf}
            disabled={exportingPdf}
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            {exportingPdf ? "Exporting…" : "Export PDF"}
          </button>
        </aside>

        <section className="col-span-12 lg:col-span-6 bg-white border rounded p-6">
          {active ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium">
                  {active.order}. {active.title}
                </h2>
                {readOnly ? (
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    {active.status}
                  </span>
                ) : (
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
                )}
              </div>
              {readOnly ? (
                <div className="w-full border rounded p-3 text-sm font-mono whitespace-pre-wrap bg-gray-50">
                  {active.content}
                </div>
              ) : (
                <textarea
                  value={active.content}
                  onChange={(e) => updateActive({ content: e.target.value })}
                  rows={14}
                  className="w-full border rounded p-3 text-sm font-mono"
                />
              )}
              {!readOnly && (
                <div className="mt-3 flex justify-end items-center gap-3">
                  {savingId === active.id && <span className="text-xs text-gray-500">Saving…</span>}
                  {regeneratingId === active.id && (
                    <span className="text-xs text-gray-500">Regenerating…</span>
                  )}
                  {active.kind === "standard" && (
                    <button
                      onClick={() => regenerateSection(active)}
                      disabled={regeneratingId === active.id}
                      className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      Regenerate from data
                    </button>
                  )}
                  <button
                    onClick={() => saveSection(active)}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Save section
                  </button>
                </div>
              )}
              {!readOnly && regenerateError && (
                <div className="mt-2 text-xs text-red-600 text-right">{regenerateError}</div>
              )}
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

function SortableRow({
  section,
  isActive,
  onSelect,
  onDelete,
}: {
  section: ReportSection;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="group">
      <div
        className={`flex items-center rounded ${
          isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
        }`}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className={`px-2 py-2 cursor-grab touch-none ${
            isActive ? "text-gray-400" : "text-gray-300"
          } hover:text-gray-500`}
        >
          ≡
        </button>
        <button
          onClick={onSelect}
          className="flex-1 text-left px-1 py-2 text-sm flex justify-between items-center"
        >
          <span>
            {section.order}. {section.title}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wide ${
              isActive ? "text-gray-300" : "text-gray-400"
            }`}
          >
            {section.status}
          </span>
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete custom section"
            className={`px-2 py-2 text-xs opacity-0 group-hover:opacity-100 ${
              isActive ? "text-gray-300 hover:text-white" : "text-gray-400 hover:text-red-600"
            }`}
          >
            🗑
          </button>
        )}
      </div>
    </li>
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
