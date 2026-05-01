"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Project } from "@/lib/types";

type SortKey = "newest" | "oldest" | "nameAsc" | "nameDesc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "nameAsc", label: "Name A→Z" },
  { value: "nameDesc", label: "Name Z→A" },
];

export default function ProjectList({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? projects.filter((p) => {
          return (
            p.name.toLowerCase().includes(term) ||
            p.location.toLowerCase().includes(term) ||
            p.jurisdiction.toLowerCase().includes(term)
          );
        })
      : projects.slice();

    const sorted = filtered.slice();
    switch (sortKey) {
      case "newest":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "oldest":
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "nameAsc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "nameDesc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }
    return sorted;
  }, [projects, search, sortKey]);

  const term = search.trim();

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          aria-label="Sort projects"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="rounded border border-dashed bg-white p-10 text-center text-gray-500">
          No projects yet. Create your first project to get started.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded border border-dashed bg-white p-10 text-center text-gray-500">
          No projects match {term}.
        </div>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {visible.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block px-5 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-500">
                      {p.location} · {p.jurisdiction}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
