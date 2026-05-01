"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (res.ok) {
      setSuccess(true);
      setSubmitting(false);
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body?.error ?? "Failed to reset password.");
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Password reset</h1>
        <div className="bg-white border rounded p-6 space-y-3">
          <p className="text-sm text-green-700">Password reset. You can now sign in.</p>
          <Link href="/signin" className="underline text-sm">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Reset password</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-white border rounded p-6">
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
        <button
          type="submit"
          disabled={submitting || !token}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {submitting ? "Resetting…" : "Reset password"}
        </button>
        {!token && <div className="text-sm text-red-600">Missing or invalid token.</div>}
      </form>
    </div>
  );
}
