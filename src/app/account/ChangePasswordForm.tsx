"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture the form ref synchronously — React nulls e.currentTarget after await.
    const form = e.currentTarget;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const fd = new FormData(form);
    const currentPassword = String(fd.get("currentPassword") ?? "");
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      setSubmitting(false);
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setSuccess(true);
      setSubmitting(false);
      form.reset();
      return;
    }

    const body = await res.json().catch(() => ({}));
    setError(body?.error ?? "Failed to update password.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-1">Current password</span>
        <input
          type="password"
          name="currentPassword"
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-sm font-medium mb-1">New password</span>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-sm font-medium mb-1">Confirm new password</span>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </label>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-700">Password updated.</div>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
      >
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
