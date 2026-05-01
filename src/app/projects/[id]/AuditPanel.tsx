"use client";

import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/db";

const LABELS: Record<string, string> = {
  "project.update": "Updated project fields",
  "project.delete": "Deleted project",
  "traffic.import": "Imported traffic counts",
  "report.generate": "Generated report",
  "report.regenerate": "Regenerated report",
  "section.update": "Edited section",
  "section.regenerate": "Regenerated section",
  "section.add": "Added custom section",
  "section.delete": "Deleted section",
  "section.reorder": "Reordered sections",
  "share.add": "Added share",
  "share.remove": "Removed share",
  "share.role_change": "Changed share role",
};

const PAGE_SIZE = 50;

export default function AuditPanel({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/audit?limit=${PAGE_SIZE}`)
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 403) return null;
        throw new Error("audit fetch failed");
      })
      .then((data: AuditEntry[] | null) => {
        if (cancelled) return;
        setEntries(data);
        setHasMore(Array.isArray(data) && data.length >= PAGE_SIZE);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load audit log.");
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function loadMore() {
    if (!entries || entries.length === 0 || loadingMore) return;
    const before = entries[entries.length - 1]!.createdAt;
    setLoadingMore(true);
    try {
      const r = await fetch(
        `/api/projects/${projectId}/audit?limit=${PAGE_SIZE}&before=${encodeURIComponent(before)}`,
      );
      if (!r.ok) {
        setError("Could not load more activity.");
        return;
      }
      const data = (await r.json()) as AuditEntry[];
      setEntries([...entries, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    } catch {
      setError("Could not load more activity.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (!loaded && !error) {
    return (
      <section className="bg-white border rounded p-6">
        <h2 className="font-medium mb-3">Activity</h2>
        <p className="text-sm text-gray-500">Loading…</p>
      </section>
    );
  }
  if (error && !entries) {
    return (
      <section className="bg-white border rounded p-6">
        <h2 className="font-medium mb-3">Activity</h2>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }
  if (!entries) return null; // sharee — owner-only panel

  return (
    <section className="bg-white border rounded p-6">
      <h2 className="font-medium mb-3">Activity</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No activity yet.</p>
      ) : (
        <>
          <ul className="divide-y text-sm">
            {entries.map((e) => (
              <li key={e.id} className="py-2 flex gap-3 items-start">
                <time className="text-xs text-gray-500 w-40 shrink-0">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
                <div className="flex-1">
                  <div>{LABELS[e.action] ?? e.action}</div>
                  {e.userEmail && <div className="text-xs text-gray-500">{e.userEmail}</div>}
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-3">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm text-blue-600 hover:underline disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}
