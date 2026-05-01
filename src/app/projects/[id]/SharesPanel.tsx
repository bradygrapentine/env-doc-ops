"use client";

import { useEffect, useState } from "react";
import type { ShareRole } from "@/lib/types";

type Share = {
  userId: string;
  email: string;
  name: string;
  role: ShareRole;
  createdAt: string;
};

export default function SharesPanel({ projectId }: { projectId: string }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("reader");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/shares`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) {
          setShares(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Invite failed");
        return;
      }
      const share = (await res.json()) as Share;
      setShares((prev) => {
        const without = prev.filter((s) => s.userId !== share.userId);
        return [...without, share];
      });
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: ShareRole) {
    const res = await fetch(`/api/projects/${projectId}/shares/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) {
      setShares((prev) => prev.map((s) => (s.userId === userId ? { ...s, role: nextRole } : s)));
    }
  }

  async function remove(userId: string) {
    const res = await fetch(`/api/projects/${projectId}/shares/${userId}`, { method: "DELETE" });
    if (res.status === 204) {
      setShares((prev) => prev.filter((s) => s.userId !== userId));
    }
  }

  return (
    <section className="bg-white border rounded p-6">
      <h2 className="font-medium mb-3">Shares</h2>
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : shares.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">Not shared with anyone.</p>
      ) : (
        <ul className="divide-y mb-3">
          {shares.map((s) => (
            <li key={s.userId} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-gray-500 text-xs">{s.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Role for ${s.email}`}
                  value={s.role}
                  onChange={(e) => changeRole(s.userId, e.target.value as ShareRole)}
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value="reader">reader</option>
                  <option value="editor">editor</option>
                </select>
                <button
                  type="button"
                  onClick={() => remove(s.userId)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-500" htmlFor="invite-email">
            Invite by email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        <select
          aria-label="Invite role"
          value={role}
          onChange={(e) => setRole(e.target.value as ShareRole)}
          className="rounded border border-gray-300 px-2 py-2 text-sm"
        >
          <option value="reader">reader</option>
          <option value="editor">editor</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-black text-white px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Inviting…" : "Invite"}
        </button>
      </form>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </section>
  );
}
