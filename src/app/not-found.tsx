import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded border bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">Project not found.</h1>
        <p className="mt-2 text-sm text-gray-600">
          This might be a stale link, or the project may have been removed.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-block rounded bg-black px-4 py-2 text-white"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
