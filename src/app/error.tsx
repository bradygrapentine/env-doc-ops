"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded border bg-white p-6">
        <h1 className="text-2xl font-semibold">Something went wrong.</h1>
        {error.message ? (
          <pre className="mt-4 overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-800">
            <code>{error.message}</code>
          </pre>
        ) : null}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded border px-4 py-2"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
