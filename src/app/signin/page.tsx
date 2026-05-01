"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
      callbackUrl,
    });
    if (!res || res.error) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }
    window.location.href = res.url ?? callbackUrl;
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
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
        <label className="block">
          <span className="block text-sm font-medium mb-1">Password</span>
          <input
            type="password"
            name="password"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-gray-500">
          No account?{" "}
          <Link href="/signup" className="underline">
            Create one
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
