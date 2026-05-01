"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Forgot password</h1>
      {submitted ? (
        <div className="bg-white border rounded p-6 space-y-3">
          <p className="text-sm">
            If an account exists with that email, we&apos;ve sent a reset link.
          </p>
          <p className="text-sm text-gray-500">
            <Link href="/signin" className="underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 bg-white border rounded p-6">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-sm text-gray-500">
            <Link href="/signin" className="underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
