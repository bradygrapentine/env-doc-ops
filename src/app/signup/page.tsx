"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function SignUpPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const name = fd.get("name") as string;

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Signup failed");
      setSubmitting(false);
      return;
    }

    const r = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/" });
    if (!r || r.error) {
      setError("Account created but sign-in failed. Try the sign-in page.");
      setSubmitting(false);
      return;
    }
    window.location.href = r.url ?? "/";
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-white border rounded p-6">
        <label className="block">
          <span className="block text-sm font-medium mb-1">Name</span>
          <input name="name" required className="w-full rounded border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">Email</span>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <span className="block text-xs text-gray-500 mt-1">At least 8 characters.</span>
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {submitting ? "Creating…" : "Create account"}
        </button>
        <p className="text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/signin" className="underline">
            Sign in
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
