"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export default function DeleteAccountSection() {
  const [armed, setArmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get("currentPassword") ?? "");
    if (!currentPassword) {
      setError("Password required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Failed to delete account.");
      setSubmitting(false);
      return;
    }
    await signOut({ callbackUrl: "/signin?deleted=1" });
  }

  if (!armed) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Permanently delete your account, all projects, reports, and shares. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="rounded border border-red-300 text-red-700 px-4 py-2 text-sm hover:bg-red-50"
        >
          Delete account…
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onConfirm} className="space-y-3">
      <p className="text-sm text-red-700">
        Confirm with your current password. After deletion you&apos;ll be signed out.
      </p>
      <input
        type="password"
        name="currentPassword"
        placeholder="Current password"
        required
        className="w-full rounded border px-3 py-2 text-sm"
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-red-700 text-white px-4 py-2 text-sm hover:bg-red-800 disabled:opacity-50"
        >
          {submitting ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setArmed(false);
            setError(null);
          }}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
