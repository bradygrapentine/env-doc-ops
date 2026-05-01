"use client";

import { useState } from "react";
import type { TrafficCountRow, Period } from "@/lib/types";

const PERIODS: Period[] = ["AM", "PM", "MIDDAY", "OTHER"];

type DraftRow = {
  intersection: string;
  period: Period;
  approach: string;
  inbound: string;
  outbound: string;
  total: string;
};

const emptyDraft: DraftRow = {
  intersection: "",
  period: "AM",
  approach: "",
  inbound: "",
  outbound: "",
  total: "",
};

function rowToDraft(r: TrafficCountRow): DraftRow {
  return {
    intersection: r.intersection,
    period: r.period,
    approach: r.approach ?? "",
    inbound: String(r.inbound),
    outbound: String(r.outbound),
    total: String(r.total),
  };
}

function draftPayload(d: DraftRow) {
  return {
    intersection: d.intersection.trim(),
    period: d.period,
    approach: d.approach.trim() || undefined,
    inbound: Number(d.inbound),
    outbound: Number(d.outbound),
    total: Number(d.total),
  };
}

export default function TrafficRowsManager({
  projectId,
  initialRows,
}: {
  projectId: string;
  initialRows: TrafficCountRow[];
}) {
  const [rows, setRows] = useState<TrafficCountRow[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftRow>(emptyDraft);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<DraftRow>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(r: TrafficCountRow) {
    setEditingId(r.id);
    setEditDraft(rowToDraft(r));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(emptyDraft);
    setError(null);
  }

  async function saveEdit(rowId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/traffic-data/rows/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftPayload(editDraft)),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
      setBusy(false);
      return;
    }
    const updated = (await res.json()) as TrafficCountRow;
    setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
    setEditingId(null);
    setBusy(false);
  }

  async function deleteRow(rowId: string) {
    if (!window.confirm("Delete this row?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/traffic-data/rows/${rowId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Delete failed");
      setBusy(false);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setBusy(false);
  }

  async function addRow() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/traffic-data/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: draftPayload(addDraft) }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const issuesText = j.issues
        ? ": " + j.issues.map((i: { message: string }) => i.message).join("; ")
        : "";
      setError((j.error ?? "Add failed") + issuesText);
      setBusy(false);
      return;
    }
    const created = (await res.json()) as TrafficCountRow;
    setRows((prev) => [created, ...prev]);
    setAddDraft(emptyDraft);
    setShowAdd(false);
    setBusy(false);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Imported rows ({rows.length})</h3>
        {!showAdd && (
          <button
            type="button"
            onClick={() => {
              setShowAdd(true);
              setAddDraft(emptyDraft);
              setError(null);
            }}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            + Add row
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

      {showAdd && (
        <div className="rounded border bg-gray-50 p-3 mb-3 text-sm space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              className="border rounded px-2 py-1"
              placeholder="Intersection"
              value={addDraft.intersection}
              onChange={(e) => setAddDraft({ ...addDraft, intersection: e.target.value })}
            />
            <select
              className="border rounded px-2 py-1"
              value={addDraft.period}
              onChange={(e) => setAddDraft({ ...addDraft, period: e.target.value as Period })}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              className="border rounded px-2 py-1"
              placeholder="Approach"
              value={addDraft.approach}
              onChange={(e) => setAddDraft({ ...addDraft, approach: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Inbound"
              value={addDraft.inbound}
              onChange={(e) => setAddDraft({ ...addDraft, inbound: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Outbound"
              value={addDraft.outbound}
              onChange={(e) => setAddDraft({ ...addDraft, outbound: e.target.value })}
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Total"
              value={addDraft.total}
              onChange={(e) => setAddDraft({ ...addDraft, total: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRow}
              disabled={busy}
              className="rounded bg-green-700 text-white px-3 py-1 text-sm disabled:opacity-50 hover:bg-green-800"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Intersection", "Period", "Approach", "Inbound", "Outbound", "Total", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 50).map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <tr key={r.id}>
                    {isEditing ? (
                      <>
                        <td className="px-2 py-1">
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={editDraft.intersection}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, intersection: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            className="border rounded px-2 py-1"
                            value={editDraft.period}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, period: e.target.value as Period })
                            }
                          >
                            {PERIODS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={editDraft.approach}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, approach: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="border rounded px-2 py-1 w-20"
                            value={editDraft.inbound}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, inbound: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="border rounded px-2 py-1 w-20"
                            value={editDraft.outbound}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, outbound: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="border rounded px-2 py-1 w-20"
                            value={editDraft.total}
                            onChange={(e) => setEditDraft({ ...editDraft, total: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(r.id)}
                              disabled={busy}
                              className="rounded bg-green-700 text-white px-2 py-1 text-xs disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">{r.intersection}</td>
                        <td className="px-3 py-2">{r.period}</td>
                        <td className="px-3 py-2">{r.approach ?? "—"}</td>
                        <td className="px-3 py-2">{r.inbound}</td>
                        <td className="px-3 py-2">{r.outbound}</td>
                        <td className="px-3 py-2">{r.total}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              aria-label="Edit row"
                              title="Edit"
                              className="text-gray-600 hover:text-gray-900"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow(r.id)}
                              aria-label="Delete row"
                              title="Delete"
                              className="text-red-600 hover:text-red-800"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 50 && (
            <div className="text-xs text-gray-500 px-3 py-2 bg-gray-50">
              Showing first 50 of {rows.length}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
