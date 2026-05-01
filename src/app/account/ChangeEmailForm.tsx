"use client";

import { useState } from "react";

export default function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const fd = new FormData(form);
    const newEmail = String(fd.get("newEmail") ?? "").trim();
    const currentPassword = String(fd.get("currentPassword") ?? "");

    if (!newEmail) {
      setError("New email is required.");
      setSubmitting(false);
      return;
    }
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError("New email must differ from current email.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, currentPassword }),
    });

    if (res.ok) {
      setSuccess(true);
      setSubmitting(false);
      form.reset();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body?.error ?? "Failed to start email change.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-1">New email</span>
        <input
          type="email"
          name="newEmail"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-sm font-medium mb-1">Current password</span>
        <input
          type="password"
          name="currentPassword"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </label>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && (
        <div className="text-sm text-green-700">
          Confirmation link sent. Click it from your new email to finish the change.
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
      >
        {submitting ? "Sending…" : "Send confirmation link"}
      </button>
    </form>
  );
}
