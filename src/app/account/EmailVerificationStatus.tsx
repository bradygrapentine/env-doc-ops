"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function EmailVerificationStatus({ verified }: { verified: boolean }) {
  const params = useSearchParams();
  const flash = params.get("verified");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onResend() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/auth/send-verification", { method: "POST" });
    if (res.ok) {
      setSent(true);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Failed to send verification email.");
    }
    setSending(false);
  }

  return (
    <div className="space-y-3">
      {flash === "1" && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded p-3 text-sm">
          Email verified.
        </div>
      )}
      {flash === "error" && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-3 text-sm">
          Verification link is invalid or expired.
        </div>
      )}
      {!verified && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded p-3 text-sm flex items-center justify-between gap-3">
          <span>Email not verified — check your inbox.</span>
          {sent ? (
            <span className="text-green-800">Verification email sent.</span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={sending}
              className="underline text-yellow-900 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
