"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type PeekState =
  | { kind: "loading" }
  | { kind: "ready"; newEmail: string }
  | { kind: "error"; error: string };

export default function ConfirmEmailChangePage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [peek, setPeek] = useState<PeekState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setPeek({ kind: "error", error: "missing" });
      return;
    }
    (async () => {
      const res = await fetch(`/api/auth/confirm-email-change?token=${encodeURIComponent(token)}`);
      if (cancelled) return;
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { newEmail?: string };
        if (body.newEmail) {
          setPeek({ kind: "ready", newEmail: body.newEmail });
          return;
        }
        setPeek({ kind: "error", error: "invalid" });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setPeek({ kind: "error", error: body.error ?? "invalid" });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch("/api/auth/confirm-email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push("/account?email_change=ok");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitError(body.error ?? "Failed to confirm email change.");
    setSubmitting(false);
  }

  function onCancel() {
    router.push("/account");
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Confirm email change</h1>
      <div className="bg-white border rounded p-6 space-y-4">
        {peek.kind === "loading" && <p className="text-sm text-gray-600">Loading…</p>}
        {peek.kind === "error" && (
          <p className="text-sm text-red-600">
            This confirmation link is {peek.error}. Request a new email change from your account
            page.
          </p>
        )}
        {peek.kind === "ready" && (
          <>
            <p className="text-sm">
              Confirm change to <span className="font-medium">{peek.newEmail}</span>?
            </p>
            {submitError && <div className="text-sm text-red-600">{submitError}</div>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-800"
              >
                {submitting ? "Confirming…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="rounded border px-4 py-2 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
